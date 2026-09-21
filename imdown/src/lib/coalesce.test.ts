import { describe, expect, it, vi } from 'vitest'
import { coalesce, debounce } from './coalesce'

const tick = () => new Promise((r) => setTimeout(r, 0))

describe('coalesce', () => {
  it('runs once when nothing overlaps', async () => {
    const run = vi.fn(async () => {})
    const refresh = coalesce(run)
    await refresh()
    await refresh()
    expect(run).toHaveBeenCalledTimes(2)
  })

  it('collapses a burst into one follow-up run', async () => {
    let release: () => void = () => {}
    const run = vi.fn(() => new Promise<void>((r) => { release = r }))
    const refresh = coalesce(run)

    const first = refresh()
    // Five callers arrive while the first is still in flight.
    const rest = [refresh(), refresh(), refresh(), refresh(), refresh()]
    expect(run).toHaveBeenCalledTimes(1)

    release()
    await tick()
    // They share a single second run rather than queueing five.
    expect(run).toHaveBeenCalledTimes(2)

    release()
    await Promise.all([first, ...rest])
    expect(run).toHaveBeenCalledTimes(2)
  })

  it('never hands back a run that started before the caller asked', async () => {
    const started: number[] = []
    let now = 0
    let release: () => void = () => {}
    const run = () => {
      started.push(now)
      return new Promise<void>((r) => { release = r })
    }
    const refresh = coalesce(run)

    const first = refresh()       // starts at t=0
    now = 1                       // a write happens
    const second = refresh()      // must see it

    release()
    await tick()
    release()
    await Promise.all([first, second])

    // The second run began after the write, so the caller cannot see stale data.
    expect(started).toEqual([0, 1])
  })

  it('recovers after a failed run', async () => {
    let fail = true
    const run = vi.fn(async () => {
      if (fail) { fail = false; throw new Error('network') }
    })
    const refresh = coalesce(run)

    await expect(refresh()).rejects.toThrow('network')
    await expect(refresh()).resolves.toBeUndefined()
    expect(run).toHaveBeenCalledTimes(2)
  })
})

describe('debounce', () => {
  it('fires once for a burst', () => {
    vi.useFakeTimers()
    const fn = vi.fn()
    const d = debounce(fn, 150)
    d(); d(); d(); d()
    expect(fn).not.toHaveBeenCalled()
    vi.advanceTimersByTime(150)
    expect(fn).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it('fires again for a later burst', () => {
    vi.useFakeTimers()
    const fn = vi.fn()
    const d = debounce(fn, 150)
    d()
    vi.advanceTimersByTime(150)
    d()
    vi.advanceTimersByTime(150)
    expect(fn).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })

  it('can be cancelled on teardown', () => {
    vi.useFakeTimers()
    const fn = vi.fn()
    const d = debounce(fn, 150)
    d()
    d.cancel()
    vi.advanceTimersByTime(500)
    expect(fn).not.toHaveBeenCalled()
    vi.useRealTimers()
  })
})
