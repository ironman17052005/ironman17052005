import { MIN_THRESHOLD, type Hangout, type Id, type Plan, type Snapshot, type Tap, type TimeSlot } from '../types'

export const uid = () => Math.random().toString(36).slice(2, 10)

/** Short, link-friendly token for share URLs. */
export const shareToken = () => Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 6)

export const money = (n: number) => (n === 0 ? 'free' : `$${n}/person`)

const DAY = 864e5

// ---------------------------------------------------------------- time slots

/** Next three sensible slots: Fri 7pm, Sat 2pm, Sun 6pm. */
export function proposeSlots(now = new Date()): TimeSlot[] {
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

// ---------------------------------------------------------------- tap rules

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

// ---------------------------------------------------------------- search

const words = (s: string) => s.toLowerCase().match(/[a-z0-9$]+/g) ?? []

/** Everything about a plan that someone might type, weighted by how much it means. */
function haystack(p: Plan): { text: string; weight: number }[] {
  return [
    { text: p.title, weight: 3 },
    { text: p.vibe.join(' '), weight: 2 },
    { text: p.area, weight: 2 },
    { text: p.bestTime, weight: 1.5 },
    { text: p.steps.join(' '), weight: 1.5 },
    { text: p.tips.join(' '), weight: 0.7 },
  ]
}

/**
 * Scores a plan against a typed query. Every word has to appear somewhere, so
 * "karaoke chinatown" does not match a plan that is only one of those, and a
 * prefix counts (typing "karao" finds karaoke) because people search as they type.
 */
export function searchScore(plan: Plan, query: string): number {
  const terms = words(query)
  if (terms.length === 0) return 0
  const fields = haystack(plan)
  let total = 0
  for (const term of terms) {
    let best = 0
    for (const f of fields) {
      for (const w of words(f.text)) {
        if (w === term) best = Math.max(best, f.weight)
        else if (w.startsWith(term)) best = Math.max(best, f.weight * 0.6)
        else if (term.length >= 4 && w.includes(term)) best = Math.max(best, f.weight * 0.3)
      }
    }
    if (best === 0) return 0 // a word nobody matched means this is not the plan
    total += best
  }
  return total / terms.length
}

// ---------------------------------------------------------------- tonight

const WEEKEND = ['fri', 'sat', 'sun']

/**
 * Does this plan suit the day someone is actually holding the phone on? Best
 * time is free text, so this reads it loosely rather than pretending it is data.
 */
export function suitsDay(plan: Plan, when = new Date()): boolean {
  const t = plan.bestTime.toLowerCase()
  if (!t.trim() || t.includes('any')) return true
  const dow = when.getDay()
  const short = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][dow]
  if (t.includes(short)) return true
  const weekend = dow === 0 || dow === 5 || dow === 6
  if (weekend && (t.includes('weekend') || WEEKEND.some((d) => t.includes(d)))) return true
  if (!weekend && (t.includes('weeknight') || t.includes('weekday'))) return true
  return false
}

// ---------------------------------------------------------------- ranking

export interface FeedContext {
  meId: Id
  friends: Id[]
  taps: Tap[]
  /** planId -> ISO date this circle last did it, so the feed stops repeating itself. */
  doneAt: Record<Id, string>
  saved: Id[]
  now?: number
}

/** What you keep tapping is what you like. Weights are normalised so one heavy user of one vibe cannot dominate. */
export function tasteProfile(plans: Plan[], ctx: FeedContext): Record<string, number> {
  const mine = new Set(ctx.taps.filter((t) => t.userId === ctx.meId).map((t) => t.planId))
  for (const id of Object.keys(ctx.doneAt)) mine.add(id)
  for (const id of ctx.saved) mine.add(id)

  const counts: Record<string, number> = {}
  let total = 0
  for (const p of plans) {
    if (!mine.has(p.id)) continue
    for (const v of p.vibe) { counts[v] = (counts[v] ?? 0) + 1; total++ }
  }
  if (total === 0) return {}
  for (const k of Object.keys(counts)) counts[k] /= total
  return counts
}

/** The median of what you usually spend, used to nudge plans toward your budget. */
export function typicalSpend(plans: Plan[], ctx: FeedContext): number | null {
  const mine = new Set(ctx.taps.filter((t) => t.userId === ctx.meId).map((t) => t.planId))
  const costs = plans.filter((p) => mine.has(p.id)).map((p) => p.costPerPerson).sort((a, b) => a - b)
  if (costs.length === 0) return null
  return costs[Math.floor(costs.length / 2)]
}

export interface ScoreBreakdown {
  friends: number
  mine: number
  taste: number
  proof: number
  fresh: number
  budget: number
  today: number
  repeat: number
  total: number
}

/**
 * Why a plan sits where it sits. Friends wanting to go beats everything, because
 * that is the only signal that turns into an actual night out. Everything else
 * breaks ties: what you tend to like, how many groups have proven it, how recently,
 * whether it fits tonight and your usual budget. Something your group just did is
 * pushed down so the feed keeps moving.
 */
export function scorePlan(plan: Plan, ctx: FeedContext, taste: Record<string, number>, spend: number | null): ScoreBreakdown {
  const now = ctx.now ?? Date.now()

  const friendCount = friendTaps(ctx.taps, plan.id, ctx.friends).length
  const friends = 3 * Math.min(friendCount, 3)

  const mine = ctx.taps.some((t) => t.planId === plan.id && t.userId === ctx.meId) ? 1.5 : 0

  const overlap = plan.vibe.reduce((sum, v) => sum + (taste[v] ?? 0), 0)
  const tasteScore = 1.2 * Math.min(overlap, 1)

  const proof = 0.8 * Math.log10(1 + plan.doneCount)

  const ageDays = Math.max(0, (now - Date.parse(plan.lastDoneAt)) / DAY)
  const fresh = Math.exp(-ageDays / 30)

  const budget = spend === null ? 0 : 0.5 * Math.max(0, 1 - Math.abs(plan.costPerPerson - spend) / Math.max(spend, 15))

  const today = suitsDay(plan, new Date(now)) ? 0.4 : 0

  const doneIso = ctx.doneAt[plan.id]
  const sinceDone = doneIso ? (now - Date.parse(doneIso)) / DAY : Infinity
  const repeat = sinceDone < 21 ? -2.5 * (1 - sinceDone / 21) : 0

  const total = friends + mine + tasteScore + proof + fresh + budget + today + repeat
  return { friends, mine, taste: tasteScore, proof, fresh, budget, today, repeat, total }
}

export type Sort = 'for-you' | 'proven' | 'new' | 'cheap' | 'quick'

export interface Filters {
  q: string
  vibes: string[]
  maxCost: number | null
  maxHours: number | null
  tonightOnly: boolean
  savedOnly: boolean
  sort: Sort
}

export const emptyFilters: Filters = {
  q: '', vibes: [], maxCost: null, maxHours: null, tonightOnly: false, savedOnly: false, sort: 'for-you',
}

export function isFiltered(f: Filters): boolean {
  return f.q.trim() !== '' || f.vibes.length > 0 || f.maxCost !== null || f.maxHours !== null || f.tonightOnly || f.savedOnly
}

/**
 * One pass: narrow to what was asked for, then order it. A typed query overrides
 * the chosen sort, because when someone searches they want the closest match first.
 */
export function buildFeed(plans: Plan[], filters: Filters, ctx: FeedContext): Plan[] {
  const saved = new Set(ctx.saved)
  const q = filters.q.trim()

  let out = plans.filter((p) => {
    if (filters.savedOnly && !saved.has(p.id)) return false
    if (filters.vibes.length && !filters.vibes.every((v) => p.vibe.includes(v))) return false
    if (filters.maxCost !== null && p.costPerPerson > filters.maxCost) return false
    if (filters.maxHours !== null && p.hours > filters.maxHours) return false
    if (filters.tonightOnly && !suitsDay(p, new Date(ctx.now ?? Date.now()))) return false
    if (q && searchScore(p, q) === 0) return false
    return true
  })

  if (q) {
    const scored = out.map((p) => ({ p, s: searchScore(p, q) }))
    scored.sort((a, b) => b.s - a.s || b.p.doneCount - a.p.doneCount)
    return scored.map((x) => x.p)
  }

  switch (filters.sort) {
    case 'cheap':
      out = [...out].sort((a, b) => a.costPerPerson - b.costPerPerson || b.doneCount - a.doneCount)
      break
    case 'quick':
      out = [...out].sort((a, b) => a.hours - b.hours || b.doneCount - a.doneCount)
      break
    case 'proven':
      out = [...out].sort((a, b) => b.doneCount - a.doneCount)
      break
    case 'new':
      out = [...out].sort((a, b) => Date.parse(b.lastDoneAt) - Date.parse(a.lastDoneAt))
      break
    default: {
      const taste = tasteProfile(plans, ctx)
      const spend = typicalSpend(plans, ctx)
      const scored = out.map((p) => ({ p, s: scorePlan(p, ctx, taste, spend).total }))
      scored.sort((a, b) => b.s - a.s || b.p.doneCount - a.p.doneCount)
      out = scored.map((x) => x.p)
    }
  }
  return out
}

/**
 * "Just tell me what to do." Picks from the top of the feed rather than the very
 * first item, so pressing it twice does not give the same answer every time.
 */
export function surprise(plans: Plan[], ctx: FeedContext, rand: () => number = Math.random): Plan | null {
  const pool = buildFeed(plans, { ...emptyFilters, tonightOnly: true }, ctx)
  const from = (pool.length ? pool : buildFeed(plans, emptyFilters, ctx)).slice(0, 8)
  if (from.length === 0) return null
  return from[Math.floor(rand() * from.length)]
}

/** planId -> when this circle last finished it, from settled hangouts. */
export function doneHistory(snap: Snapshot): Record<Id, string> {
  const out: Record<Id, string> = {}
  for (const h of snap.hangouts) {
    if (h.status !== 'done') continue
    const at = h.recap?.at ?? h.createdAt
    if (!out[h.planId] || Date.parse(at) > Date.parse(out[h.planId])) out[h.planId] = at
  }
  return out
}
