/**
 * Collapses overlapping refreshes into as few runs as possible, without ever
 * returning a result that predates the call.
 *
 * Live mode refetches the whole snapshot after every write, and a realtime
 * event triggers another. Tapping a plan can easily fire three refreshes that
 * are all asking the same question, and on a phone that is three round trips
 * for one answer.
 *
 * Naively sharing the in-flight promise would be wrong: a caller who just wrote
 * something would be handed a fetch that started before their write and would
 * see stale data. So a request that arrives mid-flight does not join that run,
 * it schedules exactly one more after it. Any number of callers waiting during
 * a single run therefore share one follow-up run, and every one of them
 * observes a fetch that began after they asked.
 */
export function coalesce(run: () => Promise<void>): () => Promise<void> {
  let active: Promise<void> | null = null
  let again = false

  const start = (): Promise<void> => {
    active = (async () => {
      try {
        do {
          again = false
          await run()
        } while (again)
      } finally {
        active = null
      }
    })()
    return active
  }

  return () => {
    if (active) {
      again = true
      return active
    }
    return start()
  }
}

/**
 * Waits for a gap in the noise before acting. Realtime delivers one event per
 * changed row, so a hangout being created arrives as a burst: the hangout, its
 * members, three time slots. That is one thing happening, and it deserves one
 * refresh.
 */
export function debounce(fn: () => void, ms: number): (() => void) & { cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null
  const wrapped = () => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      fn()
    }, ms)
  }
  wrapped.cancel = () => {
    if (timer) clearTimeout(timer)
    timer = null
  }
  return wrapped
}
