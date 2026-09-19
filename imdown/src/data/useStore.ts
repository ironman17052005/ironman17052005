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
}

/**
 * Picks the store: Supabase when env vars exist and the user is signed in,
 * otherwise the localStorage demo. Re-renders on every store change.
 */
export function useStore(): State & { reload: () => void } {
  const mode: Mode = supabase ? 'live' : 'demo'
  const [userId, setUserId] = useState<string | null>(null)
  const [authChecked, setAuthChecked] = useState(mode === 'demo')
  const [snap, setSnap] = useState<Snapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user.id ?? null)
      setAuthChecked(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setUserId(session?.user.id ?? null))
    return () => sub.subscription.unsubscribe()
  }, [])

  const store = useMemo<Store | null>(() => {
    if (mode === 'demo') return new DemoStore()
    if (supabase && userId) return new SupabaseStore(supabase, userId)
    return null
  }, [mode, userId])

  useEffect(() => {
    if (!store) return
    let alive = true
    const pull = () => store.load().then((s) => alive && setSnap(s)).catch((e) => alive && setError(String(e.message ?? e)))
    pull()
    const unsub = store.subscribe(pull)
    return () => { alive = false; unsub() }
  }, [store, tick])

  return {
    mode,
    store,
    snap,
    needsAuth: mode === 'live' && authChecked && !userId,
    error,
    reload: () => setTick((t) => t + 1),
  }
}
