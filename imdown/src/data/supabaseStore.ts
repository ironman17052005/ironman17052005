/* eslint-disable @typescript-eslint/no-explicit-any */
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'
import type { Hangout, Id, Plan, Profile, Share, Snapshot, Store } from '../types'
import { shareToken } from './logic'

/** Nothing fails quietly. A dropped vote or message must surface, not look like success. */
function rows<T>(res: { data: T[] | null; error: PostgrestError | null }, what: string): T[] {
  if (res.error) throw new Error(`${what}: ${res.error.message}`)
  return res.data ?? []
}

function one<T>(res: { data: T | null; error: PostgrestError | null }, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.message}`)
  if (!res.data) throw new Error(`${what}: not found`)
  return res.data
}

/**
 * Live mode. The rules that matter (consent to friendship, the tap threshold,
 * single settlement of an outing) are enforced in Postgres, not here, so a second
 * client or a curl request cannot route around them. See supabase/schema.sql.
 */
export class SupabaseStore implements Store {
  private sb: SupabaseClient
  private userId: Id
  private listeners = new Set<() => void>()
  private snap: Snapshot | null = null

  constructor(sb: SupabaseClient, userId: Id) {
    this.sb = sb
    this.userId = userId
  }

  subscribe(cb: () => void) {
    this.listeners.add(cb)
    const ch = this.sb
      .channel('imdown')
      .on('postgres_changes', { event: '*', schema: 'public' }, () => void this.refresh())
      .subscribe()
    return () => {
      this.listeners.delete(cb)
      void this.sb.removeChannel(ch)
    }
  }

  private async refresh() {
    await this.load()
    this.listeners.forEach((l) => l())
  }

  async load(): Promise<Snapshot> {
    const [meRes, friendsRes, reqRes, plansRes, tapsRes, hangoutsRes, sharesRes, guestRes, savedRes] = await Promise.all([
      this.sb.from('profiles').select('*').eq('id', this.userId).single(),
      this.sb.from('friendships').select('friend_id').eq('user_id', this.userId),
      this.sb.from('friend_requests').select('*'),
      this.sb.from('plans').select('*').order('last_done_at', { ascending: false }),
      this.sb.from('taps').select('*'),
      this.sb
        .from('hangouts')
        .select('*, hangout_members(user_id), time_slots(*, slot_votes(user_id)), messages(*)')
        .order('created_at', { ascending: false }),
      this.sb.from('shares').select('*'),
      this.sb.from('guest_interests').select('*'),
      this.sb.from('saves').select('plan_id').eq('user_id', this.userId),
    ])

    const meRow = one<any>(meRes, 'load profile')
    const friends: Id[] = rows<{ friend_id: Id }>(friendsRes, 'load friends').map((r) => r.friend_id)
    const requests = rows<any>(reqRes, 'load friend requests')
    const planRows = rows<any>(plansRes, 'load plans')
    const tapRows = rows<any>(tapsRes, 'load taps')
    const hangoutRows = rows<any>(hangoutsRes, 'load hangouts')
    const shareRows = rows<any>(sharesRes, 'load shares')
    const guestRows = rows<any>(guestRes, 'load interest')
    const savedRows = rows<{ plan_id: Id }>(savedRes, 'load saved')

    // Everyone we need a name or emoji for, in one round trip.
    const ids = new Set<Id>([this.userId, ...friends])
    for (const r of requests) { ids.add(r.from_id); ids.add(r.to_id) }
    for (const h of hangoutRows) for (const m of h.hangout_members) ids.add(m.user_id)
    for (const t of tapRows) ids.add(t.user_id)
    const peopleRows = rows<any>(await this.sb.from('profiles').select('*').in('id', Array.from(ids)), 'load people')

    const people: Record<Id, Profile> = {}
    for (const p of peopleRows) {
      people[p.id] = { id: p.id, username: p.username, displayName: p.display_name, emoji: p.emoji, threshold: p.threshold }
    }

    const plans: Plan[] = planRows.map((p) => ({
      id: p.id, title: p.title, steps: p.steps, area: p.area, vibe: p.vibe,
      costPerPerson: Number(p.cost_per_person), hours: Number(p.hours), bestTime: p.best_time, tips: p.tips,
      doneCount: p.done_count, lastDoneAt: p.last_done_at, createdBy: p.created_by,
    }))

    const hangouts: Hangout[] = hangoutRows.map((h) => ({
      id: h.id,
      planId: h.plan_id,
      members: h.hangout_members.map((m: { user_id: Id }) => m.user_id),
      status: h.status,
      chosenSlotId: h.chosen_slot_id,
      createdAt: h.created_at,
      recap: h.recap_at ? { note: h.recap_note ?? '', photo: h.recap_photo ?? null, at: h.recap_at } : null,
      slots: h.time_slots
        .map((s: { id: Id; label: string; at: string; slot_votes: { user_id: Id }[] }) => ({
          id: s.id, label: s.label, at: s.at, votes: s.slot_votes.map((v) => v.user_id),
        }))
        .sort((a: { at: string }, b: { at: string }) => Date.parse(a.at) - Date.parse(b.at)),
      messages: h.messages
        .map((m: { id: Id; user_id: Id; text: string; created_at: string }) => ({ id: m.id, userId: m.user_id, text: m.text, at: m.created_at }))
        .sort((a: { at: string }, b: { at: string }) => Date.parse(a.at) - Date.parse(b.at)),
    }))

    this.snap = {
      me: { id: meRow.id, username: meRow.username, displayName: meRow.display_name, emoji: meRow.emoji, threshold: meRow.threshold },
      people,
      friends,
      incoming: requests.filter((r) => r.to_id === this.userId).map((r) => ({ id: r.id, from: r.from_id, to: r.to_id, at: r.created_at })),
      outgoing: requests.filter((r) => r.from_id === this.userId).map((r) => ({ id: r.id, from: r.from_id, to: r.to_id, at: r.created_at })),
      plans,
      taps: tapRows.map((t) => ({ planId: t.plan_id, userId: t.user_id, at: t.created_at })),
      hangouts,
      shares: shareRows.map((s) => ({ id: s.id, planId: s.plan_id, by: s.by_id, at: s.created_at })),
      guestInterests: guestRows.map((g) => ({ shareId: g.share_id, name: g.name, at: g.created_at })),
      saved: savedRows.map((r) => r.plan_id),
    }
    return this.snap
  }

  private async rpc(fn: string, args: Record<string, unknown>, what: string) {
    const { error } = await this.sb.rpc(fn, args)
    if (error) throw new Error(`${what}: ${error.message}`)
    await this.refresh()
  }

  async tap(planId: Id) {
    const { error } = await this.sb.from('taps').insert({ plan_id: planId, user_id: this.userId })
    if (error && error.code !== '23505') throw new Error(`tap: ${error.message}`) // 23505 = already tapped
    await this.refresh()
  }

  async untap(planId: Id) {
    const { error } = await this.sb.from('taps').delete().eq('plan_id', planId).eq('user_id', this.userId)
    if (error) throw new Error(`untap: ${error.message}`)
    await this.refresh()
  }

  joinHangout = (id: Id) => this.rpc('join_hangout', { p_hangout: id }, 'join hangout')
  voteTime = (h: Id, s: Id) => this.rpc('vote_time', { p_hangout: h, p_slot: s }, 'vote')
  markOutcome = (h: Id, happened: boolean) => this.rpc('mark_outcome', { p_hangout: h, p_happened: happened }, 'mark outcome')
  addRecap = (h: Id, note: string, photo: string | null) => this.rpc('add_recap', { p_hangout: h, p_note: note, p_photo: photo }, 'save recap')
  acceptFriendRequest = (id: Id) => this.rpc('accept_friend_request', { p_request: id }, 'accept request')
  declineFriendRequest = (id: Id) => this.rpc('decline_friend_request', { p_request: id }, 'decline request')
  removeFriend = (id: Id) => this.rpc('remove_friend', { p_friend: id }, 'remove friend')

  async sendMessage(hangoutId: Id, text: string) {
    const { error } = await this.sb.from('messages').insert({ hangout_id: hangoutId, user_id: this.userId, text })
    if (error) throw new Error(`send message: ${error.message}`)
    await this.refresh()
  }

  async toggleSaved(planId: Id) {
    const on = this.snap?.saved.includes(planId)
    const { error } = on
      ? await this.sb.from('saves').delete().eq('plan_id', planId).eq('user_id', this.userId)
      : await this.sb.from('saves').insert({ plan_id: planId, user_id: this.userId })
    if (error && error.code !== '23505') throw new Error(`save: ${error.message}`)
    await this.refresh()
  }

  async setThreshold(n: number) {
    const { error } = await this.sb.from('profiles').update({ threshold: n }).eq('id', this.userId)
    if (error) throw new Error(`save setting: ${error.message}`)
    await this.refresh()
  }

  private planRow(input: Omit<Plan, 'id' | 'doneCount' | 'lastDoneAt' | 'createdBy'>, doneCount: number) {
    return {
      title: input.title, steps: input.steps, area: input.area, vibe: input.vibe,
      cost_per_person: input.costPerPerson, hours: input.hours, best_time: input.bestTime, tips: input.tips,
      done_count: doneCount, created_by: this.userId,
    }
  }

  async createPlan(input: Omit<Plan, 'id' | 'doneCount' | 'lastDoneAt' | 'createdBy'>) {
    const { error } = await this.sb.from('plans').insert(this.planRow(input, 1))
    if (error) throw new Error(`post plan: ${error.message}`)
    await this.refresh()
  }

  async copyPlan(planId: Id) {
    const src = this.snap?.plans.find((p) => p.id === planId)
    if (!src) throw new Error('copy plan: not found')
    const { error } = await this.sb.from('plans').insert(this.planRow(src, src.doneCount))
    if (error) throw new Error(`copy plan: ${error.message}`)
    await this.refresh()
  }

  async sendFriendRequest(username: string) {
    const u = username.trim().toLowerCase().replace(/^@/, '')
    const { data, error } = await this.sb.from('profiles').select('id').eq('username', u).maybeSingle()
    if (error) return `Lookup failed: ${error.message}`
    if (!data) return 'No user with that username.'
    const { data: msg, error: rpcErr } = await this.sb.rpc('send_friend_request', { p_to: data.id })
    if (rpcErr) return rpcErr.message
    await this.refresh()
    return (msg as string | null) ?? null
  }

  async createShare(planId: Id) {
    const mine = this.snap?.shares.find((s) => s.planId === planId && s.by === this.userId)
    if (mine) return mine.id
    const id = shareToken()
    const { error } = await this.sb.from('shares').insert({ id, plan_id: planId, by_id: this.userId })
    if (error) throw new Error(`create link: ${error.message}`)
    await this.refresh()
    return id
  }

  async addGuestInterest(shareId: Id, name: string) {
    const { data, error } = await this.sb.rpc('add_guest_interest', { p_share: shareId, p_name: name })
    if (error) return error.message
    await this.refresh()
    return (data as string | null) ?? null
  }

  async getShare(shareId: Id) {
    const { data, error } = await this.sb.rpc('get_share', { p_share: shareId })
    if (error) throw new Error(`open link: ${error.message}`)
    const row = Array.isArray(data) ? data[0] : data
    if (!row) return null
    const plan: Plan = {
      id: row.plan_id, title: row.title, steps: row.steps, area: row.area, vibe: row.vibe,
      costPerPerson: Number(row.cost_per_person), hours: Number(row.hours), bestTime: row.best_time, tips: row.tips,
      doneCount: row.done_count, lastDoneAt: new Date().toISOString(), createdBy: null,
    }
    const share: Share = { id: shareId, planId: row.plan_id, by: '', at: new Date().toISOString() }
    return { share, plan, names: (row.names as string[]) ?? [], by: row.shared_by as string }
  }
}
