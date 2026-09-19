import { describe, expect, it } from 'vitest'
import {
  applyOutcome, applyVote, buildFeed, doneHistory, emptyFilters, isFiltered, openHangoutFor,
  resolveTap, scorePlan, searchScore, suitsDay, surprise, tasteProfile, typicalSpend,
  type FeedContext,
} from './logic'
import type { Hangout, Plan, Snapshot } from '../types'

const DAY = 864e5
const NOW = Date.parse('2026-09-19T12:00:00Z') // a Saturday

const plan = (id: string, over: Partial<Plan> = {}): Plan => ({
  id, title: id, steps: ['a'], area: '', vibe: [], costPerPerson: 10, hours: 2,
  bestTime: '', tips: [], doneCount: 0, lastDoneAt: new Date(0).toISOString(), createdBy: null, ...over,
})

const hangout = (over: Partial<Hangout> = {}): Hangout => ({
  id: 'h1', planId: 'p1', members: ['me', 'a'], status: 'voting',
  slots: [
    { id: 's1', label: 'Fri', at: new Date().toISOString(), votes: [] },
    { id: 's2', label: 'Sat', at: new Date().toISOString(), votes: [] },
  ],
  chosenSlotId: null, messages: [], recap: null, createdAt: new Date().toISOString(), ...over,
})

const snap = (over: Partial<Snapshot> = {}): Snapshot => ({
  me: { id: 'me', username: 'me', displayName: 'Me', emoji: '🙂', threshold: 2 },
  people: {}, friends: ['a', 'b'], incoming: [], outgoing: [],
  plans: [plan('p1')], taps: [], hangouts: [], shares: [], guestInterests: [], saved: [], ...over,
})

const ctx = (over: Partial<FeedContext> = {}): FeedContext =>
  ({ meId: 'me', friends: ['a', 'b'], taps: [], doneAt: {}, saved: [], now: NOW, ...over })

const friendsOf = () => ['a', 'b']
const tap = (userId: string, planId = 'p1') => ({ planId, userId, at: new Date().toISOString() })

// ------------------------------------------------------------------ tap rules

describe('resolveTap', () => {
  it('does nothing while the circle is short of the threshold', () => {
    expect(resolveTap(snap({ taps: [tap('me')] }), 'p1', 'me', friendsOf, 2).kind).toBe('none')
  })

  it('proposes once enough of the circle is down', () => {
    const res = resolveTap(snap({ taps: [tap('me'), tap('a')] }), 'p1', 'me', friendsOf, 2)
    expect(res.kind).toBe('create')
    if (res.kind === 'create') {
      // Proposing is not confirming: a time still has to win a vote.
      expect(res.hangout.status).toBe('voting')
      expect(res.hangout.chosenSlotId).toBeNull()
      expect(res.hangout.members.sort()).toEqual(['a', 'me'])
      expect(res.hangout.slots).toHaveLength(3)
    }
  })

  it('respects a raised threshold', () => {
    expect(resolveTap(snap({ taps: [tap('me'), tap('a')] }), 'p1', 'me', friendsOf, 3).kind).toBe('none')
  })

  it('never drops below two, even if a bad threshold is passed in', () => {
    expect(resolveTap(snap({ taps: [tap('me')] }), 'p1', 'me', friendsOf, 1).kind).toBe('none')
  })

  it('lets a late friend join instead of stranding them', () => {
    const s = snap({ hangouts: [hangout({ members: ['a', 'b'] })], taps: [tap('a'), tap('b'), tap('me')] })
    expect(resolveTap(s, 'p1', 'me', friendsOf, 2)).toEqual({ kind: 'join', hangoutId: 'h1' })
  })

  it('does not re-join a hangout you are already in', () => {
    const s = snap({ hangouts: [hangout({ members: ['me', 'a'] })], taps: [tap('me'), tap('a')] })
    expect(resolveTap(s, 'p1', 'me', friendsOf, 2).kind).toBe('none')
  })

  it('ignores a settled hangout and proposes a fresh one', () => {
    const s = snap({ hangouts: [hangout({ status: 'done' })], taps: [tap('me'), tap('a')] })
    expect(resolveTap(s, 'p1', 'me', friendsOf, 2).kind).toBe('create')
  })

  it('does not count taps from outside your circle', () => {
    expect(resolveTap(snap({ taps: [tap('me'), tap('stranger')] }), 'p1', 'me', friendsOf, 2).kind).toBe('none')
  })
})

describe('applyVote', () => {
  it('confirms when a majority lands on one slot', () => {
    let h = hangout({ members: ['me', 'a', 'b'] })
    h = applyVote(h, 'me', 's1')
    expect(h.status).toBe('voting')
    h = applyVote(h, 'a', 's1')
    expect(h.status).toBe('confirmed')
    expect(h.chosenSlotId).toBe('s1')
  })

  it('moves your vote rather than counting it twice', () => {
    let h = hangout({ members: ['me', 'a', 'b'] })
    h = applyVote(h, 'me', 's1')
    h = applyVote(h, 'me', 's2')
    expect(h.slots.find((s) => s.id === 's1')!.votes).toEqual([])
    expect(h.slots.find((s) => s.id === 's2')!.votes).toEqual(['me'])
    expect(h.status).toBe('voting')
  })

  it('two people agreeing is enough for a pair', () => {
    let h = hangout({ members: ['me', 'a'] })
    h = applyVote(h, 'me', 's1')
    h = applyVote(h, 'a', 's1')
    expect(h.status).toBe('confirmed')
  })
})

describe('applyOutcome', () => {
  it('counts a hangout that happened exactly once', () => {
    const plans = [plan('p1', { doneCount: 4 })]
    const first = applyOutcome(plans, hangout({ status: 'confirmed' }), true)
    expect(first.changed).toBe(true)
    expect(first.plans[0].doneCount).toBe(5)

    // Pressing "we did it" again, or a second member pressing it, must not inflate the count.
    const second = applyOutcome(first.plans, first.hangout, true)
    expect(second.changed).toBe(false)
    expect(second.plans[0].doneCount).toBe(5)
  })

  it('does not count a flop', () => {
    const res = applyOutcome([plan('p1', { doneCount: 4 })], hangout({ status: 'confirmed' }), false)
    expect(res.hangout.status).toBe('flopped')
    expect(res.plans[0].doneCount).toBe(4)
  })

  it('will not reopen a settled hangout', () => {
    const res = applyOutcome([plan('p1', { doneCount: 4 })], hangout({ status: 'flopped' }), true)
    expect(res.changed).toBe(false)
    expect(res.hangout.status).toBe('flopped')
  })
})

describe('openHangoutFor', () => {
  it('finds only live hangouts for people you know', () => {
    const s = snap({ hangouts: [hangout({ status: 'done' }), hangout({ id: 'h2', members: ['b'] })] })
    expect(openHangoutFor(s, 'p1', ['me', 'a', 'b'])?.id).toBe('h2')
    expect(openHangoutFor(s, 'p1', ['stranger'])).toBeUndefined()
  })
})

// ------------------------------------------------------------------ search

describe('searchScore', () => {
  const karaoke = plan('k', {
    title: 'Hot pot then karaoke', area: 'Houston · Chinatown', vibe: ['food', 'late night'],
    steps: ['Hot pot at Tan Tan', 'Karaoke at KBox'], tips: ['Cash only'], bestTime: 'Fri/Sat night',
  })

  it('finds a plan by a word in its title', () => {
    expect(searchScore(karaoke, 'karaoke')).toBeGreaterThan(0)
  })

  it('matches a prefix, because people search while typing', () => {
    expect(searchScore(karaoke, 'karao')).toBeGreaterThan(0)
  })

  it('searches the area, the vibe and the steps too', () => {
    expect(searchScore(karaoke, 'chinatown')).toBeGreaterThan(0)
    expect(searchScore(karaoke, 'food')).toBeGreaterThan(0)
    expect(searchScore(karaoke, 'kbox')).toBeGreaterThan(0)
  })

  it('requires every word to match something', () => {
    expect(searchScore(karaoke, 'karaoke bowling')).toBe(0)
  })

  it('ignores case and punctuation', () => {
    expect(searchScore(karaoke, '  KARAOKE!  ')).toBeGreaterThan(0)
  })

  it('scores a title hit above a tip hit', () => {
    expect(searchScore(karaoke, 'karaoke')).toBeGreaterThan(searchScore(karaoke, 'cash'))
  })

  it('returns nothing for an empty query', () => {
    expect(searchScore(karaoke, '   ')).toBe(0)
  })
})

// ------------------------------------------------------------------ tonight

describe('suitsDay', () => {
  const sat = new Date(NOW)
  const wed = new Date(Date.parse('2026-09-16T12:00:00Z'))

  it('treats an empty or "any" best time as always fine', () => {
    expect(suitsDay(plan('x', { bestTime: '' }), sat)).toBe(true)
    expect(suitsDay(plan('x', { bestTime: 'Any night' }), sat)).toBe(true)
  })

  it('matches the named day', () => {
    expect(suitsDay(plan('x', { bestTime: 'Sat night' }), sat)).toBe(true)
    expect(suitsDay(plan('x', { bestTime: 'Sat night' }), wed)).toBe(false)
  })

  it('understands weeknight and weekend', () => {
    expect(suitsDay(plan('x', { bestTime: 'Weeknight' }), wed)).toBe(true)
    expect(suitsDay(plan('x', { bestTime: 'Weeknight' }), sat)).toBe(false)
    expect(suitsDay(plan('x', { bestTime: 'Fri/Sat night' }), sat)).toBe(true)
  })
})

// ------------------------------------------------------------------ ranking

describe('taste and budget', () => {
  it('learns which vibes you keep tapping', () => {
    const plans = [plan('a', { vibe: ['food'] }), plan('b', { vibe: ['food'] }), plan('c', { vibe: ['sport'] })]
    const t = tasteProfile(plans, ctx({ taps: [tap('me', 'a'), tap('me', 'b')] }))
    expect(t.food).toBeCloseTo(1)
    expect(t.sport).toBeUndefined()
  })

  it('has no opinion before you have tapped anything', () => {
    expect(tasteProfile([plan('a', { vibe: ['food'] })], ctx())).toEqual({})
    expect(typicalSpend([plan('a')], ctx())).toBeNull()
  })

  it('takes your usual spend from what you tapped', () => {
    const plans = [plan('a', { costPerPerson: 10 }), plan('b', { costPerPerson: 20 }), plan('c', { costPerPerson: 90 })]
    expect(typicalSpend(plans, ctx({ taps: [tap('me', 'a'), tap('me', 'b'), tap('me', 'c')] }))).toBe(20)
  })
})

describe('scorePlan', () => {
  it('weighs friends being down above everything else', () => {
    const p = plan('p1')
    const withFriends = scorePlan(p, ctx({ taps: [tap('a'), tap('b')] }), {}, null)
    const alone = scorePlan(p, ctx(), {}, null)
    expect(withFriends.friends).toBeGreaterThan(0)
    expect(withFriends.total).toBeGreaterThan(alone.total + 3)
  })

  it('stops rewarding a pile-on past three friends', () => {
    const many = ctx({ friends: ['a', 'b', 'c', 'd'], taps: [tap('a'), tap('b'), tap('c'), tap('d')] })
    const three = ctx({ friends: ['a', 'b', 'c'], taps: [tap('a'), tap('b'), tap('c')] })
    expect(scorePlan(plan('p1'), many, {}, null).friends).toBe(scorePlan(plan('p1'), three, {}, null).friends)
  })

  it('pushes down something the group just did', () => {
    const p = plan('p1')
    const justDid = scorePlan(p, ctx({ doneAt: { p1: new Date(NOW - 2 * DAY).toISOString() } }), {}, null)
    const longAgo = scorePlan(p, ctx({ doneAt: { p1: new Date(NOW - 200 * DAY).toISOString() } }), {}, null)
    expect(justDid.repeat).toBeLessThan(0)
    expect(longAgo.repeat).toBe(0)
    expect(justDid.total).toBeLessThan(longAgo.total)
  })

  it('rewards a plan proven recently over one nobody has done in a year', () => {
    const fresh = plan('f', { lastDoneAt: new Date(NOW - DAY).toISOString() })
    const stale = plan('s', { lastDoneAt: new Date(NOW - 365 * DAY).toISOString() })
    expect(scorePlan(fresh, ctx(), {}, null).fresh).toBeGreaterThan(scorePlan(stale, ctx(), {}, null).fresh)
  })

  it('leans toward what you usually spend', () => {
    const cheap = plan('c', { costPerPerson: 20 })
    const pricey = plan('p', { costPerPerson: 200 })
    expect(scorePlan(cheap, ctx(), {}, 20).budget).toBeGreaterThan(scorePlan(pricey, ctx(), {}, 20).budget)
  })

  it('gives no budget opinion when it knows nothing about you', () => {
    expect(scorePlan(plan('p'), ctx(), {}, null).budget).toBe(0)
  })
})

// ------------------------------------------------------------------ the feed

describe('buildFeed', () => {
  const plans = [
    plan('cheapquick', { costPerPerson: 5, hours: 1, doneCount: 1, vibe: ['chill'], bestTime: 'Any' }),
    plan('pricey', { costPerPerson: 80, hours: 6, doneCount: 50, vibe: ['drinks'], bestTime: 'Sat night' }),
    plan('middle', { costPerPerson: 25, hours: 3, doneCount: 10, vibe: ['food'], bestTime: 'Weeknight' }),
  ]

  it('puts what friends are down for first', () => {
    const order = buildFeed(plans, emptyFilters, ctx({ taps: [tap('a', 'middle')] })).map((p) => p.id)
    expect(order[0]).toBe('middle')
  })

  it('filters by cost, by length and by vibe', () => {
    expect(buildFeed(plans, { ...emptyFilters, maxCost: 10 }, ctx()).map((p) => p.id)).toEqual(['cheapquick'])
    expect(buildFeed(plans, { ...emptyFilters, maxHours: 3 }, ctx()).map((p) => p.id).sort()).toEqual(['cheapquick', 'middle'])
    expect(buildFeed(plans, { ...emptyFilters, vibes: ['food'] }, ctx()).map((p) => p.id)).toEqual(['middle'])
  })

  it('shows only saved plans when asked', () => {
    expect(buildFeed(plans, { ...emptyFilters, savedOnly: true }, ctx({ saved: ['pricey'] })).map((p) => p.id)).toEqual(['pricey'])
  })

  it('narrows to what suits today', () => {
    // NOW is a Saturday, so the weeknight plan drops out.
    const ids = buildFeed(plans, { ...emptyFilters, tonightOnly: true }, ctx()).map((p) => p.id)
    expect(ids).toContain('pricey')
    expect(ids).not.toContain('middle')
  })

  it('sorts by price, by length and by proof on request', () => {
    expect(buildFeed(plans, { ...emptyFilters, sort: 'cheap' }, ctx())[0].id).toBe('cheapquick')
    expect(buildFeed(plans, { ...emptyFilters, sort: 'quick' }, ctx())[0].id).toBe('cheapquick')
    expect(buildFeed(plans, { ...emptyFilters, sort: 'proven' }, ctx())[0].id).toBe('pricey')
  })

  it('lets a typed query override the chosen sort', () => {
    const out = buildFeed(plans, { ...emptyFilters, q: 'drinks', sort: 'cheap' }, ctx())
    expect(out.map((p) => p.id)).toEqual(['pricey'])
  })

  it('combines a filter with a query', () => {
    expect(buildFeed(plans, { ...emptyFilters, q: 'chill', maxCost: 10 }, ctx())).toHaveLength(1)
    expect(buildFeed(plans, { ...emptyFilters, q: 'chill', maxCost: 1 }, ctx())).toHaveLength(0)
  })

  it('returns everything when nothing is asked of it', () => {
    expect(buildFeed(plans, emptyFilters, ctx())).toHaveLength(3)
    expect(isFiltered(emptyFilters)).toBe(false)
    expect(isFiltered({ ...emptyFilters, q: 'x' })).toBe(true)
  })
})

describe('surprise', () => {
  const plans = [plan('a', { bestTime: 'Any' }), plan('b', { bestTime: 'Any' }), plan('c', { bestTime: 'Any' })]

  it('always returns something when there are plans', () => {
    expect(surprise(plans, ctx(), () => 0)?.id).toBeTruthy()
  })

  it('does not always return the same one', () => {
    const first = surprise(plans, ctx(), () => 0)
    const last = surprise(plans, ctx(), () => 0.99)
    expect(first?.id).not.toBe(last?.id)
  })

  it('falls back to any plan when nothing suits today', () => {
    const weeknightOnly = [plan('w', { bestTime: 'Weeknight' })]
    expect(surprise(weeknightOnly, ctx(), () => 0)?.id).toBe('w')
  })

  it('returns nothing when there are no plans at all', () => {
    expect(surprise([], ctx(), () => 0)).toBeNull()
  })
})

describe('doneHistory', () => {
  it('records only outings that actually happened, keeping the latest', () => {
    const s = snap({
      hangouts: [
        hangout({ id: 'h1', planId: 'p1', status: 'done', createdAt: new Date(NOW - 10 * DAY).toISOString() }),
        hangout({ id: 'h2', planId: 'p1', status: 'done', createdAt: new Date(NOW - 2 * DAY).toISOString() }),
        hangout({ id: 'h3', planId: 'p2', status: 'flopped' }),
      ],
    })
    const hist = doneHistory(s)
    expect(Date.parse(hist.p1)).toBe(NOW - 2 * DAY)
    expect(hist.p2).toBeUndefined()
  })
})
