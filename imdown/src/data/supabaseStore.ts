import type { SupabaseClient } from '@supabase/supabase-js'
import type { Hangout, Id, Plan, Profile, Snapshot, Store } from '../types'

/**
 * Real mode. Tables and the 3-tap trigger live in supabase/schema.sql.
 * The hangout creation rule runs in Postgres so it stays consistent across clients.
 */
export class SupabaseStore implements Store {
  private listeners = new Set<() => void>()
  private snap: Snapshot | null = null

  private sb: SupabaseClient
  private userId: Id

  constructor(sb: SupabaseClient, userId: Id) {
    this.sb = sb
    this.userId = userId
  }

  subscribe(cb: () => void) {
    this.listeners.add(cb)
    const ch = this.sb
      .channel('imdown')
      .on('postgres_changes', { event: '*', schema: 'public' }, () => this.refresh())
      .subscribe()
    return () => {
      this.listeners.delete(cb)
      this.sb.removeChannel(ch)
    }
  }

  private async refresh() {
    await this.load()
    this.listeners.forEach((l) => l())
  }

  async load(): Promise<Snapshot> {
    const [meRes, friendsRes, plansRes, tapsRes, hangoutsRes] = await Promise.all([
      this.sb.from('profiles').select('*').eq('id', this.userId).single(),
      this.sb.from('friendships').select('friend_id').eq('user_id', this.userId),
      this.sb.from('plans').select('*').order('last_done_at', { ascending: false }),
      this.sb.from('taps').select('*'),
      this.sb.from('hangouts').select('*, hangout_members(user_id), time_slots(*, slot_votes(user_id)), messages(*)').order('created_at', { ascending: false }),
    ])
    if (meRes.error) throw meRes.error
    const friends: Id[] = (friendsRes.data ?? []).map((r: { friend_id: Id }) => r.friend_id)

    const ids = new Set<Id>([this.userId, ...friends])
    for (const h of hangoutsRes.data ?? []) for (const m of h.hangout_members) ids.add(m.user_id)
    for (const t of tapsRes.data ?? []) ids.add(t.user_id)
    const peopleRes = await this.sb.from('profiles').select('*').in('id', Array.from(ids))
    const people: Record<Id, Profile> = {}
    for (const p of peopleRes.data ?? []) people[p.id] = { id: p.id, username: p.username, displayName: p.display_name, emoji: p.emoji }

    const plans: Plan[] = (plansRes.data ?? []).map((p) => ({
      id: p.id, title: p.title, steps: p.steps, area: p.area, vibe: p.vibe, cost: p.cost, hours: p.hours,
      bestTime: p.best_time, doneCount: p.done_count, lastDoneAt: p.last_done_at, createdBy: p.created_by,
    }))
    const taps = (tapsRes.data ?? []).map((t) => ({ planId: t.plan_id, userId: t.user_id, at: t.created_at }))
    const hangouts: Hangout[] = (hangoutsRes.data ?? []).map((h) => ({
      id: h.id,
      planId: h.plan_id,
      members: h.hangout_members.map((m: { user_id: Id }) => m.user_id),
      status: h.status,
      chosenSlotId: h.chosen_slot_id,
      createdAt: h.created_at,
      slots: h.time_slots.map((s: { id: Id; label: string; at: string; slot_votes: { user_id: Id }[] }) => ({ id: s.id, label: s.label, at: s.at, votes: s.slot_votes.map((v) => v.user_id) })),
      messages: h.messages.map((m: { id: Id; user_id: Id; text: string; created_at: string }) => ({ id: m.id, userId: m.user_id, text: m.text, at: m.created_at })),
    }))

    const me = people[this.userId]
    this.snap = { me, people, friends, plans, taps, hangouts }
    return this.snap
  }

  async tap(planId: Id) {
    const { error } = await this.sb.from('taps').insert({ plan_id: planId, user_id: this.userId })
    if (error && error.code !== '23505') throw error
    await this.refresh()
  }

  async untap(planId: Id) {
    await this.sb.from('taps').delete().eq('plan_id', planId).eq('user_id', this.userId)
    await this.refresh()
  }

  async voteTime(hangoutId: Id, slotId: Id) {
    await this.sb.rpc('vote_time', { p_hangout: hangoutId, p_slot: slotId })
    await this.refresh()
  }

  async sendMessage(hangoutId: Id, text: string) {
    await this.sb.from('messages').insert({ hangout_id: hangoutId, user_id: this.userId, text })
    await this.refresh()
  }

  async markOutcome(hangoutId: Id, happened: boolean) {
    await this.sb.rpc('mark_outcome', { p_hangout: hangoutId, p_happened: happened })
    await this.refresh()
  }

  async createPlan(input: Omit<Plan, 'id' | 'doneCount' | 'lastDoneAt' | 'createdBy'>) {
    await this.sb.from('plans').insert({
      title: input.title, steps: input.steps, area: input.area, vibe: input.vibe, cost: input.cost,
      hours: input.hours, best_time: input.bestTime, done_count: 1, created_by: this.userId,
    })
    await this.refresh()
  }

  async addFriend(username: string) {
    const u = username.trim().toLowerCase().replace(/^@/, '')
    const { data } = await this.sb.from('profiles').select('id').eq('username', u).maybeSingle()
    if (!data) return 'No user with that username.'
    if (data.id === this.userId) return 'That is you.'
    const { error } = await this.sb.rpc('add_friend', { p_friend: data.id })
    if (error) return error.message
    await this.refresh()
    return null
  }
}
