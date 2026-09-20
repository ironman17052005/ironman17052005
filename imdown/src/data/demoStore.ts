import type { Id, Plan, PlanInput, Snapshot, Store } from '../types'

import { seedFriends, seedPeople, seedPlans, seedRequesters } from './seed'
import { applyOutcome, applyVote, resolveTap, shareToken, uid } from './logic'

const KEY = 'imdown.demo.v2'

/**
 * Demo mode: everything is in localStorage and the other people are simulated.
 *
 * The simulation is deliberately unreliable. A friend is down roughly half the
 * time, replies late, and sometimes votes for a different night. Getting people
 * to commit is the hard part of this product, so the demo must not pretend it
 * is free. Use "nudge" to force a reply when you want to walk the whole loop.
 */
export class DemoStore implements Store {
  private snap: Snapshot
  private listeners = new Set<() => void>()
  private timers: ReturnType<typeof setTimeout>[] = []
  /** Set by the app so a full storage quota surfaces instead of failing silently. */
  onQuota: (() => void) | null = null

  constructor() {
    const saved = localStorage.getItem(KEY)
    this.snap = saved ? (JSON.parse(saved) as Snapshot) : DemoStore.fresh()
    // A share link opened in another tab writes to the same storage. Pick that up
    // instead of letting this tab's copy drift.
    window.addEventListener('storage', (e) => {
      if (e.key !== KEY || !e.newValue) return
      // Another tab could write anything, including garbage. Parsing it
      // unguarded would take down every tab that is merely listening.
      let incoming: Snapshot
      try {
        incoming = JSON.parse(e.newValue) as Snapshot
      } catch {
        return
      }
      this.snap = incoming
      this.listeners.forEach((l) => l())
    })
  }

  private static persisted(): Snapshot | null {
    try {
      const raw = localStorage.getItem(KEY)
      return raw ? (JSON.parse(raw) as Snapshot) : null
    } catch {
      return null
    }
  }

  static fresh(): Snapshot {
    const people = Object.fromEntries(seedPeople.map((p) => [p.id, p]))
    const plans: Plan[] = seedPlans.map((s) => ({ ...s, id: uid(), createdBy: null }))
    const now = new Date().toISOString()
    return {
      me: people['u_me'],
      people,
      friends: [...seedFriends],
      // Two people want to be your friend. Nobody joins your circle until you accept.
      incoming: seedRequesters.map((from) => ({ id: uid(), from, to: 'u_me', at: now })),
      outgoing: [],
      plans,
      // One friend is already down for one plan, so the feed is not empty on day one.
      taps: [{ planId: plans[0].id, userId: 'u_1', at: now }],
      hangouts: [],
      shares: [],
      guestInterests: [],
      saved: [],
    }
  }

  async load() { return this.snap }

  subscribe(cb: () => void) {
    this.listeners.add(cb)
    return () => { this.listeners.delete(cb) }
  }

  /**
   * Writes the whole snapshot, but never drops guest interest that the public
   * share page wrote from another tab. A delayed simulated reply must not erase
   * a real person saying they are in.
   */
  private commit(next: Snapshot) {
    const onDisk = DemoStore.persisted()
    if (onDisk) {
      const seen = new Set(next.guestInterests.map((g) => `${g.shareId}|${g.name.toLowerCase()}`))
      const extra = onDisk.guestInterests.filter((g) => !seen.has(`${g.shareId}|${g.name.toLowerCase()}`))
      if (extra.length) next = { ...next, guestInterests: [...next.guestInterests, ...extra] }
    }
    this.snap = next
    try {
      localStorage.setItem(KEY, JSON.stringify(next))
    } catch {
      // Out of browser storage, almost always a recap photo. Keep the app usable
      // in memory and say so rather than dying on a write nobody asked about.
      this.onQuota?.()
    }
    this.listeners.forEach((l) => l())
  }

  private later(fn: () => void, ms: number) { this.timers.push(setTimeout(fn, ms)) }

  reset() {
    this.timers.forEach(clearTimeout)
    this.timers = []
    this.commit(DemoStore.fresh())
  }

  private friendsOf = (id: Id): Id[] =>
    id === this.snap.me.id ? this.snap.friends : [this.snap.me.id, ...this.snap.friends.filter((f) => f !== id)]

  /** Applies one tap and whatever it triggers: nothing, a new proposal, or joining an open one. */
  private addTap(planId: Id, userId: Id) {
    if (this.snap.taps.some((t) => t.planId === planId && t.userId === userId)) return
    const next: Snapshot = { ...this.snap, taps: [...this.snap.taps, { planId, userId, at: new Date().toISOString() }] }
    const res = resolveTap(next, planId, userId, this.friendsOf, this.snap.me.threshold)
    if (res.kind === 'create') this.commit({ ...next, hangouts: [res.hangout, ...next.hangouts] })
    else if (res.kind === 'join')
      this.commit({
        ...next,
        hangouts: next.hangouts.map((h) => (h.id === res.hangoutId ? { ...h, members: [...h.members, userId] } : h)),
      })
    else this.commit(next)
  }

  async tap(planId: Id) {
    this.addTap(planId, this.snap.me.id)
    // Each friend decides on their own. Most of the time, most of them do not reply.
    const already = new Set(this.snap.taps.filter((t) => t.planId === planId).map((t) => t.userId))
    this.snap.friends
      .filter((f) => !already.has(f))
      .forEach((f) => {
        if (Math.random() > 0.45) return
        this.later(() => this.addTap(planId, f), 1500 + Math.random() * 4000)
      })
  }

  async untap(planId: Id) {
    this.commit({ ...this.snap, taps: this.snap.taps.filter((t) => !(t.planId === planId && t.userId === this.snap.me.id)) })
  }

  /** Demo escape hatch: make one undecided friend say yes right now. */
  nudge(planId: Id) {
    const already = new Set(this.snap.taps.filter((t) => t.planId === planId).map((t) => t.userId))
    const next = this.snap.friends.find((f) => !already.has(f))
    if (next) this.addTap(planId, next)
  }

  async joinHangout(hangoutId: Id) {
    const h = this.snap.hangouts.find((x) => x.id === hangoutId)
    if (!h || h.members.includes(this.snap.me.id)) return
    this.commit({
      ...this.snap,
      hangouts: this.snap.hangouts.map((x) => (x.id === hangoutId ? { ...x, members: [...x.members, this.snap.me.id] } : x)),
    })
  }

  async voteTime(hangoutId: Id, slotId: Id) {
    const me = this.snap.me.id
    this.commit({ ...this.snap, hangouts: this.snap.hangouts.map((h) => (h.id === hangoutId ? applyVote(h, me, slotId) : h)) })
    const h = this.snap.hangouts.find((x) => x.id === hangoutId)
    if (!h) return
    // Friends vote on their own schedule and do not always want your night.
    h.members.filter((m) => m !== me).forEach((m) => {
      this.later(() => {
        const cur = this.snap.hangouts.find((x) => x.id === hangoutId)
        if (!cur || cur.status !== 'voting') return
        if (Math.random() > 0.7) return // some people just never vote
        const pick = Math.random() < 0.6 ? slotId : cur.slots[Math.floor(Math.random() * cur.slots.length)].id
        this.commit({ ...this.snap, hangouts: this.snap.hangouts.map((x) => (x.id === hangoutId ? applyVote(x, m, pick) : x)) })
      }, 1200 + Math.random() * 3500)
    })
  }

  /** Demo escape hatch: make one member who has not voted pick this slot. */
  nudgeVote(hangoutId: Id, slotId: Id) {
    const h = this.snap.hangouts.find((x) => x.id === hangoutId)
    if (!h) return
    const voted = new Set(h.slots.flatMap((s) => s.votes))
    const who = h.members.find((m) => m !== this.snap.me.id && !voted.has(m))
    if (who) this.commit({ ...this.snap, hangouts: this.snap.hangouts.map((x) => (x.id === hangoutId ? applyVote(x, who, slotId) : x)) })
  }

  async sendMessage(hangoutId: Id, text: string) {
    const msg = { id: uid(), userId: this.snap.me.id, text, at: new Date().toISOString() }
    this.commit({ ...this.snap, hangouts: this.snap.hangouts.map((h) => (h.id === hangoutId ? { ...h, messages: [...h.messages, msg] } : h)) })
  }

  async markOutcome(hangoutId: Id, happened: boolean) {
    const h = this.snap.hangouts.find((x) => x.id === hangoutId)
    if (!h) return
    const { plans, hangout, changed } = applyOutcome(this.snap.plans, h, happened)
    if (!changed) return
    const taps = this.snap.taps.filter((t) => !(t.planId === h.planId && h.members.includes(t.userId)))
    this.commit({ ...this.snap, plans, taps, hangouts: this.snap.hangouts.map((x) => (x.id === hangoutId ? hangout : x)) })
  }

  async addRecap(hangoutId: Id, note: string, photo: string | null) {
    this.commit({
      ...this.snap,
      hangouts: this.snap.hangouts.map((h) => (h.id === hangoutId ? { ...h, recap: { note, photo, at: new Date().toISOString() } } : h)),
    })
  }

  async createPlan(input: PlanInput) {
    const plan: Plan = { ...input, id: uid(), doneCount: 1, lastDoneAt: new Date().toISOString(), createdBy: this.snap.me.id }
    this.commit({ ...this.snap, plans: [plan, ...this.snap.plans] })
  }

  async updatePlan(planId: Id, input: PlanInput) {
    this.commit({
      ...this.snap,
      plans: this.snap.plans.map((p) => (p.id === planId && p.createdBy === this.snap.me.id ? { ...p, ...input } : p)),
    })
  }

  async deletePlan(planId: Id) {
    const plan = this.snap.plans.find((p) => p.id === planId)
    if (!plan || plan.createdBy !== this.snap.me.id) return 'You can only delete a plan you posted.'
    if (this.snap.hangouts.some((h) => h.planId === planId && (h.status === 'voting' || h.status === 'confirmed'))) {
      return 'People are already planning this one. Settle it first.'
    }
    this.commit({
      ...this.snap,
      plans: this.snap.plans.filter((p) => p.id !== planId),
      taps: this.snap.taps.filter((t) => t.planId !== planId),
      saved: this.snap.saved.filter((id) => id !== planId),
      shares: this.snap.shares.filter((sh) => sh.planId !== planId),
    })
    return null
  }

  async toggleSaved(planId: Id) {
    const on = this.snap.saved.includes(planId)
    this.commit({ ...this.snap, saved: on ? this.snap.saved.filter((id) => id !== planId) : [...this.snap.saved, planId] })
  }

  async setThreshold(n: number) {
    const me = { ...this.snap.me, threshold: n }
    this.commit({ ...this.snap, me, people: { ...this.snap.people, [me.id]: me } })
  }

  async sendFriendRequest(username: string) {
    const u = username.trim().toLowerCase().replace(/^@/, '')
    const person = Object.values(this.snap.people).find((p) => p.username === u)
    if (!person) return 'No one with that username. Demo users: minh, jess, dre, tina, omar'
    if (person.id === this.snap.me.id) return 'That is you.'
    if (this.snap.friends.includes(person.id)) return 'Already friends.'
    if (this.snap.outgoing.some((r) => r.to === person.id)) return 'Request already sent.'
    const incoming = this.snap.incoming.find((r) => r.from === person.id)
    if (incoming) { await this.acceptFriendRequest(incoming.id); return null }
    const req = { id: uid(), from: this.snap.me.id, to: person.id, at: new Date().toISOString() }
    this.commit({ ...this.snap, outgoing: [...this.snap.outgoing, req] })
    // They accept later, or they don't.
    this.later(() => {
      if (Math.random() > 0.7) return
      const still = this.snap.outgoing.find((r) => r.id === req.id)
      if (!still) return
      this.commit({
        ...this.snap,
        outgoing: this.snap.outgoing.filter((r) => r.id !== req.id),
        friends: [...this.snap.friends, person.id],
      })
    }, 2500 + Math.random() * 3000)
    return null
  }

  async acceptFriendRequest(id: Id) {
    const req = this.snap.incoming.find((r) => r.id === id)
    if (!req) return
    this.commit({
      ...this.snap,
      incoming: this.snap.incoming.filter((r) => r.id !== id),
      friends: this.snap.friends.includes(req.from) ? this.snap.friends : [...this.snap.friends, req.from],
    })
  }

  async declineFriendRequest(id: Id) {
    this.commit({ ...this.snap, incoming: this.snap.incoming.filter((r) => r.id !== id) })
  }

  async removeFriend(id: Id) {
    this.commit({ ...this.snap, friends: this.snap.friends.filter((f) => f !== id) })
  }

  async createShare(planId: Id) {
    const existing = this.snap.shares.find((s) => s.planId === planId && s.by === this.snap.me.id)
    if (existing) return existing.id
    const share = { id: shareToken(), planId, by: this.snap.me.id, at: new Date().toISOString() }
    this.commit({ ...this.snap, shares: [...this.snap.shares, share] })
    return share.id
  }

  async addGuestInterest(shareId: Id, name: string) {
    const clean = name.trim().slice(0, 24)
    if (clean.length < 2) return 'Put a name so they know who is in.'
    if (!this.snap.shares.some((s) => s.id === shareId)) return 'This link is not valid.'
    if (this.snap.guestInterests.some((g) => g.shareId === shareId && g.name.toLowerCase() === clean.toLowerCase())) return 'You are already in.'
    this.commit({ ...this.snap, guestInterests: [...this.snap.guestInterests, { shareId, name: clean, at: new Date().toISOString() }] })
    return null
  }

  async getShare(shareId: Id) {
    const share = this.snap.shares.find((s) => s.id === shareId)
    if (!share) return null
    const plan = this.snap.plans.find((p) => p.id === share.planId)
    if (!plan) return null
    const names = this.snap.guestInterests.filter((g) => g.shareId === shareId).map((g) => g.name)
    return { share, plan, names, by: this.snap.people[share.by]?.displayName ?? 'someone' }
  }
}
