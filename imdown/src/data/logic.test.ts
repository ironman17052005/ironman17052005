import { describe, expect, it } from 'vitest'
import { applyOutcome, applyVote, openHangoutFor, rankFeed, resolveTap } from './logic'
import type { Hangout, Plan, Snapshot } from '../types'

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
  plans: [plan('p1')], taps: [], hangouts: [], shares: [], guestInterests: [], ...over,
})

const friendsOf = () => ['a', 'b']
const tap = (userId: string, planId = 'p1') => ({ planId, userId, at: new Date().toISOString() })

describe('resolveTap', () => {
  it('does nothing while the circle is short of the threshold', () => {
    const s = snap({ taps: [tap('me')] })
    expect(resolveTap(s, 'p1', 'me', friendsOf, 2).kind).toBe('none')
  })

  it('proposes once enough of the circle is down', () => {
    const s = snap({ taps: [tap('me'), tap('a')] })
    const res = resolveTap(s, 'p1', 'me', friendsOf, 2)
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
    const s = snap({ taps: [tap('me'), tap('a')] })
    expect(resolveTap(s, 'p1', 'me', friendsOf, 3).kind).toBe('none')
  })

  it('never drops below two, even if a bad threshold is passed in', () => {
    const s = snap({ taps: [tap('me')] })
    expect(resolveTap(s, 'p1', 'me', friendsOf, 1).kind).toBe('none')
  })

  it('lets a late friend join instead of stranding them', () => {
    const s = snap({ hangouts: [hangout({ members: ['a', 'b'] })], taps: [tap('a'), tap('b'), tap('me')] })
    const res = resolveTap(s, 'p1', 'me', friendsOf, 2)
    expect(res).toEqual({ kind: 'join', hangoutId: 'h1' })
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
    const s = snap({ taps: [tap('me'), tap('stranger')] })
    expect(resolveTap(s, 'p1', 'me', friendsOf, 2).kind).toBe('none')
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
    const plans = [plan('p1', { doneCount: 4 })]
    const res = applyOutcome(plans, hangout({ status: 'confirmed' }), false)
    expect(res.hangout.status).toBe('flopped')
    expect(res.plans[0].doneCount).toBe(4)
  })

  it('will not reopen a settled hangout', () => {
    const plans = [plan('p1', { doneCount: 4 })]
    const res = applyOutcome(plans, hangout({ status: 'flopped' }), true)
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

describe('rankFeed', () => {
  it('puts what friends are down for first, then what was proven most recently', () => {
    const old = plan('old', { lastDoneAt: new Date(1).toISOString(), doneCount: 99 })
    const recent = plan('recent', { lastDoneAt: new Date().toISOString(), doneCount: 1 })
    const tapped = plan('tapped', { lastDoneAt: new Date(1).toISOString(), doneCount: 0 })
    const order = rankFeed([old, recent, tapped], [tap('a', 'tapped')], ['a']).map((p) => p.id)
    expect(order).toEqual(['tapped', 'recent', 'old'])
  })
})
