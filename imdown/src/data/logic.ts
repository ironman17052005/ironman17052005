import { MIN_THRESHOLD, type Hangout, type Id, type Plan, type Snapshot, type Tap, type TimeSlot } from '../types'

export const uid = () => Math.random().toString(36).slice(2, 10)

/** Short, link-friendly token for share URLs. */
export const shareToken = () => Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 6)

/** Next three sensible slots: Fri 7pm, Sat 2pm, Sun 6pm. */
export function proposeSlots(): TimeSlot[] {
  const now = new Date()
  const mk = (dow: number, hour: number): Date => {
    const d = new Date(now)
    const diff = (dow - d.getDay() + 7) % 7 || 7
    d.setDate(d.getDate() + diff)
    d.setHours(hour, 0, 0, 0)
    return d
  }
  const fmt = (d: Date) => d.toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })
  return [mk(5, 19), mk(6, 14), mk(0, 18)].map((d) => ({ id: uid(), label: fmt(d), at: d.toISOString(), votes: [] }))
}

/** An open hangout for this plan that any of these users is already in. */
export function openHangoutFor(snap: Snapshot, planId: Id, users: Id[]): Hangout | undefined {
  return snap.hangouts.find(
    (h) => h.planId === planId && (h.status === 'voting' || h.status === 'confirmed') && h.members.some((m) => users.includes(m)),
  )
}

export type TapResult =
  | { kind: 'none' }
  | { kind: 'create'; hangout: Hangout }
  | { kind: 'join'; hangoutId: Id }

/**
 * After a tap: if enough of the tapper's circle is down, propose a hangout.
 * If one is already open for this plan, the tapper joins it rather than being stranded.
 * Proposing is not confirming — a time still has to win a vote.
 */
export function resolveTap(snap: Snapshot, planId: Id, tapperId: Id, friendsOf: (id: Id) => Id[], threshold: number): TapResult {
  const circle = [tapperId, ...friendsOf(tapperId)]
  const existing = openHangoutFor(snap, planId, circle)
  if (existing) {
    return existing.members.includes(tapperId) ? { kind: 'none' } : { kind: 'join', hangoutId: existing.id }
  }
  const tappers = snap.taps.filter((t) => t.planId === planId && circle.includes(t.userId)).map((t) => t.userId)
  if (tappers.length < Math.max(MIN_THRESHOLD, threshold)) return { kind: 'none' }
  return {
    kind: 'create',
    hangout: {
      id: uid(),
      planId,
      members: tappers,
      status: 'voting',
      slots: proposeSlots(),
      chosenSlotId: null,
      messages: [],
      recap: null,
      createdAt: new Date().toISOString(),
    },
  }
}

/** Majority of members on one slot confirms it. */
export function applyVote(h: Hangout, userId: Id, slotId: Id): Hangout {
  const slots = h.slots.map((s) => ({
    ...s,
    votes: s.id === slotId ? Array.from(new Set([...s.votes, userId])) : s.votes.filter((v) => v !== userId),
  }))
  const need = Math.floor(h.members.length / 2) + 1
  const winner = slots.find((s) => s.votes.length >= need)
  return { ...h, slots, status: winner ? 'confirmed' : 'voting', chosenSlotId: winner ? winner.id : null }
}

/**
 * A hangout that happened feeds the loop. Guarded: only an open hangout can be
 * settled, so tapping "we did it" twice cannot inflate a plan's proof count.
 */
export function applyOutcome(plans: Plan[], h: Hangout, happened: boolean): { plans: Plan[]; hangout: Hangout; changed: boolean } {
  if (h.status === 'done' || h.status === 'flopped') return { plans, hangout: h, changed: false }
  if (!happened) return { plans, hangout: { ...h, status: 'flopped' }, changed: true }
  const now = new Date().toISOString()
  return {
    plans: plans.map((p) => (p.id === h.planId ? { ...p, doneCount: p.doneCount + 1, lastDoneAt: now } : p)),
    hangout: { ...h, status: 'done' },
    changed: true,
  }
}

export function friendTaps(taps: Tap[], planId: Id, friends: Id[]): Id[] {
  return taps.filter((t) => t.planId === planId && friends.includes(t.userId)).map((t) => t.userId)
}

/** Feed order: plans friends tapped first, then recently proven, then most proven. */
export function rankFeed(plans: Plan[], taps: Tap[], friends: Id[]): Plan[] {
  return [...plans].sort((a, b) => {
    const fa = friendTaps(taps, a.id, friends).length
    const fb = friendTaps(taps, b.id, friends).length
    if (fa !== fb) return fb - fa
    const ta = Date.parse(a.lastDoneAt)
    const tb = Date.parse(b.lastDoneAt)
    if (ta !== tb) return tb - ta
    return b.doneCount - a.doneCount
  })
}

export const money = (n: number) => (n === 0 ? 'free' : `$${n}/person`)
