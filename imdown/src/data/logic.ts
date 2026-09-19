import { CONFIRM_THRESHOLD, type Hangout, type Id, type Plan, type Snapshot, type Tap, type TimeSlot } from '../types'

const uid = () => Math.random().toString(36).slice(2, 10)

/** Next three sensible slots: Fri 7pm, Sat 2pm, Sun 6pm (or next occurrences). */
export function proposeSlots(): TimeSlot[] {
  const now = new Date()
  const mk = (dow: number, hour: number): Date => {
    const d = new Date(now)
    const diff = (dow - d.getDay() + 7) % 7 || 7
    d.setDate(d.getDate() + diff)
    d.setHours(hour, 0, 0, 0)
    return d
  }
  const fmt = (d: Date) =>
    d.toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })
  return [mk(5, 19), mk(6, 14), mk(0, 18)].map((d) => ({ id: uid(), label: fmt(d), at: d.toISOString(), votes: [] }))
}

/**
 * The core rule: after a tap, if the tapper plus their friends have tapped this plan
 * (threshold reached) and none of them is already in an open hangout for it,
 * spin up a hangout with proposed times.
 */
export function maybeCreateHangout(snap: Snapshot, planId: Id, tapperId: Id, friendsOf: (id: Id) => Id[]): Hangout | null {
  const circle = new Set<Id>([tapperId, ...friendsOf(tapperId)])
  const tappers = snap.taps.filter((t) => t.planId === planId && circle.has(t.userId)).map((t) => t.userId)
  if (tappers.length < CONFIRM_THRESHOLD) return null
  const open = snap.hangouts.some(
    (h) => h.planId === planId && (h.status === 'voting' || h.status === 'confirmed') && h.members.some((m) => tappers.includes(m)),
  )
  if (open) return null
  return {
    id: uid(),
    planId,
    members: tappers,
    status: 'voting',
    slots: proposeSlots(),
    chosenSlotId: null,
    messages: [],
    createdAt: new Date().toISOString(),
  }
}

/** Majority of members on one slot confirms it. */
export function applyVote(h: Hangout, userId: Id, slotId: Id): Hangout {
  const slots = h.slots.map((s) => ({ ...s, votes: s.id === slotId ? Array.from(new Set([...s.votes, userId])) : s.votes.filter((v) => v !== userId) }))
  const need = Math.floor(h.members.length / 2) + 1
  const winner = slots.find((s) => s.votes.length >= need)
  return { ...h, slots, status: winner ? 'confirmed' : h.status, chosenSlotId: winner ? winner.id : null }
}

/** A hangout that happened feeds the loop: the plan's proof count goes up and it resurfaces. */
export function applyOutcome(plans: Plan[], h: Hangout, happened: boolean): { plans: Plan[]; hangout: Hangout } {
  if (!happened) return { plans, hangout: { ...h, status: 'flopped' } }
  const now = new Date().toISOString()
  return {
    plans: plans.map((p) => (p.id === h.planId ? { ...p, doneCount: p.doneCount + 1, lastDoneAt: now } : p)),
    hangout: { ...h, status: 'done' },
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

export { uid }
