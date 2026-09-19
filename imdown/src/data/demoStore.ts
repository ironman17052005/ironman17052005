import type { Id, Plan, Snapshot, Store } from '../types'
import { seedFriends, seedPeople, seedPlans } from './seed'
import { applyOutcome, applyVote, maybeCreateHangout, uid } from './logic'

const KEY = 'imdown.demo.v1'

/**
 * Demo mode: everything lives in localStorage and your friends are simulated.
 * When you tap a plan, one or two friends tap it a moment later so you can
 * watch the 3-tap rule create a hangout without needing real users.
 */
export class DemoStore implements Store {
  private snap: Snapshot
  private listeners = new Set<() => void>()

  constructor() {
    const saved = localStorage.getItem(KEY)
    this.snap = saved ? JSON.parse(saved) : DemoStore.fresh()
  }

  static fresh(): Snapshot {
    const people = Object.fromEntries(seedPeople.map((p) => [p.id, p]))
    const plans: Plan[] = seedPlans.map((s) => ({ ...s, id: uid(), createdBy: null }))
    // A couple of friends already tapped things, so the feed has life on first open.
    const taps = [
      { planId: plans[0].id, userId: 'u_1', at: new Date().toISOString() },
      { planId: plans[0].id, userId: 'u_2', at: new Date().toISOString() },
      { planId: plans[2].id, userId: 'u_3', at: new Date().toISOString() },
      { planId: plans[11].id, userId: 'u_4', at: new Date().toISOString() },
    ]
    return { me: people['u_me'], people, friends: [...seedFriends], plans, taps, hangouts: [] }
  }

  async load() { return this.snap }

  subscribe(cb: () => void) {
    this.listeners.add(cb)
    return () => { this.listeners.delete(cb) }
  }

  private commit(next: Snapshot) {
    this.snap = next
    localStorage.setItem(KEY, JSON.stringify(next))
    this.listeners.forEach((l) => l())
  }

  reset() { this.commit(DemoStore.fresh()) }

  private friendsOf = (id: Id): Id[] => (id === this.snap.me.id ? this.snap.friends : [this.snap.me.id, ...this.snap.friends.filter((f) => f !== id)])

  private addTap(planId: Id, userId: Id) {
    if (this.snap.taps.some((t) => t.planId === planId && t.userId === userId)) return
    const taps = [...this.snap.taps, { planId, userId, at: new Date().toISOString() }]
    const next = { ...this.snap, taps }
    const h = maybeCreateHangout(next, planId, userId, this.friendsOf)
    this.commit(h ? { ...next, hangouts: [h, ...next.hangouts] } : next)
  }

  async tap(planId: Id) {
    this.addTap(planId, this.snap.me.id)
    // Simulate friends noticing. Pick friends who have not tapped yet.
    const already = new Set(this.snap.taps.filter((t) => t.planId === planId).map((t) => t.userId))
    const candidates = this.snap.friends.filter((f) => !already.has(f))
    const howMany = Math.min(candidates.length, 1 + Math.floor(Math.random() * 2))
    candidates.slice(0, howMany).forEach((f, i) => setTimeout(() => this.addTap(planId, f), 1200 * (i + 1)))
  }

  async untap(planId: Id) {
    this.commit({ ...this.snap, taps: this.snap.taps.filter((t) => !(t.planId === planId && t.userId === this.snap.me.id)) })
  }

  async voteTime(hangoutId: Id, slotId: Id) {
    const me = this.snap.me.id
    let hangouts = this.snap.hangouts.map((h) => (h.id === hangoutId ? applyVote(h, me, slotId) : h))
    this.commit({ ...this.snap, hangouts })
    // Simulated friends vote too, mostly agreeing with you.
    const h = hangouts.find((x) => x.id === hangoutId)!
    h.members.filter((m) => m !== me).forEach((m, i) =>
      setTimeout(() => {
        const cur = this.snap.hangouts.find((x) => x.id === hangoutId)
        if (!cur || cur.status !== 'voting') return
        const pick = Math.random() < 0.8 ? slotId : cur.slots[Math.floor(Math.random() * cur.slots.length)].id
        hangouts = this.snap.hangouts.map((x) => (x.id === hangoutId ? applyVote(x, m, pick) : x))
        this.commit({ ...this.snap, hangouts })
      }, 900 * (i + 1)),
    )
  }

  async sendMessage(hangoutId: Id, text: string) {
    const msg = { id: uid(), userId: this.snap.me.id, text, at: new Date().toISOString() }
    this.commit({ ...this.snap, hangouts: this.snap.hangouts.map((h) => (h.id === hangoutId ? { ...h, messages: [...h.messages, msg] } : h)) })
  }

  async markOutcome(hangoutId: Id, happened: boolean) {
    const h = this.snap.hangouts.find((x) => x.id === hangoutId)
    if (!h) return
    const { plans, hangout } = applyOutcome(this.snap.plans, h, happened)
    // Clear the taps so the card can be tapped again next time.
    const taps = this.snap.taps.filter((t) => !(t.planId === h.planId && h.members.includes(t.userId)))
    this.commit({ ...this.snap, plans, taps, hangouts: this.snap.hangouts.map((x) => (x.id === hangoutId ? hangout : x)) })
  }

  async createPlan(input: Omit<Plan, 'id' | 'doneCount' | 'lastDoneAt' | 'createdBy'>) {
    const plan: Plan = { ...input, id: uid(), doneCount: 1, lastDoneAt: new Date().toISOString(), createdBy: this.snap.me.id }
    this.commit({ ...this.snap, plans: [plan, ...this.snap.plans] })
  }

  async addFriend(username: string) {
    const u = username.trim().toLowerCase().replace(/^@/, '')
    const person = Object.values(this.snap.people).find((p) => p.username === u)
    if (!person) return 'No one with that username in the demo. Try: minh, jess, dre, tina, omar'
    if (person.id === this.snap.me.id) return 'That is you.'
    if (this.snap.friends.includes(person.id)) return 'Already friends.'
    this.commit({ ...this.snap, friends: [...this.snap.friends, person.id] })
    return null
  }
}
