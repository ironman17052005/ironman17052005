import { useEffect, useMemo, useState } from 'react'
import type { Snapshot, Store } from '../types'
import { DemoStore } from './demoStore'
import { SupabaseStore } from './supabaseStore'
import { supabase } from '../lib/supabase'

export type Mode = 'demo' | 'live'

interface State {
  mode: Mode
  store: Store | null
  snap: Snapshot | null
  needsAuth: boolean
  error: string | null
  clearError: () => void
}

/**
 * Picks the store: Supabase when env vars exist and someone is signed in,
 * otherwise the localStorage demo. Re-renders on every store change.
 */
export function useStore(): State {
  const mode: Mode = supabase ? 'live' : 'demo'
  const [userId, setUserId] = useState<string | null>(null)
  const [authChecked, setAuthChecked] = useState(mode === 'demo')
  const [snap, setSnap] = useState<Snapshot | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase) return
    void supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user.id ?? null)
      setAuthChecked(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setUserId(session?.user.id ?? null))
    return () => sub.subscription.unsubscribe()
  }, [])

  const base = useMemo<Store | null>(() => {
    if (mode === 'demo') return new DemoStore()
    if (supabase && userId) return new SupabaseStore(supabase, userId)
    return null
  }, [mode, userId])

  useEffect(() => {
    if (!base) return
    let alive = true
    const pull = () =>
      base.load()
        .then((s) => { if (alive) { setSnap(s); setError(null) } })
        .catch((e) => alive && setError(e instanceof Error ? e.message : String(e)))
    void pull()
    const unsub = base.subscribe(() => void pull())
    return () => { alive = false; unsub() }
  }, [base])

  /**
   * Every write is wrapped so a rejected one surfaces instead of looking like it
   * worked. Silent failure is worse than an error message.
   */
  const store = useMemo<Store | null>(() => {
    if (!base) return null
    const guard = new Proxy(base, {
      get(target, prop, receiver) {
        const value = Reflect.get(target, prop, receiver)
        if (typeof value !== 'function' || prop === 'subscribe' || prop === 'load') return value
        return (...args: unknown[]) => {
          try {
            const out = (value as (...a: unknown[]) => unknown).apply(target, args)
            return out instanceof Promise
              ? out.catch((e: unknown) => { setError(e instanceof Error ? e.message : String(e)); throw e })
              : out
          } catch (e) {
            setError(e instanceof Error ? e.message : String(e))
            throw e
          }
        }
      },
    })
    return guard
  }, [base])

  return {
    mode,
    store,
    snap,
    needsAuth: mode === 'live' && authChecked && !userId,
    error,
    clearError: () => setError(null),
  }
}
