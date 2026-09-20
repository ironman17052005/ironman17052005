import { supabase } from '../lib/supabase'
import type { Plan } from '../types'

export interface SharePayload {
  plan: Plan
  names: string[]
  by: string
}

/**
 * The share page has to work for someone who is signed out and just tapped a
 * link in a group chat, so it never goes through the authenticated store.
 * In live mode it is one security-definer function that returns the outing and
 * the first names already in, and nothing else about anybody.
 */
export async function fetchShare(shareId: string): Promise<SharePayload | null> {
  if (supabase) {
    const { data, error } = await supabase.rpc('get_share', { p_share: shareId })
    if (error) throw new Error(error.message)
    const row = Array.isArray(data) ? data[0] : data
    if (!row) return null
    return {
      by: row.shared_by as string,
      names: (row.names as string[]) ?? [],
      plan: {
        id: row.plan_id, title: row.title, steps: row.steps, area: row.area, vibe: row.vibe,
        costPerPerson: Number(row.cost_per_person), hours: Number(row.hours), bestTime: row.best_time,
        tips: row.tips, doneCount: row.done_count, lastDoneAt: new Date().toISOString(), createdBy: null,
      },
    }
  }
  return readDemoShare(shareId)
}

export async function addInterest(shareId: string, name: string): Promise<string | null> {
  if (supabase) {
    const { data, error } = await supabase.rpc('add_guest_interest', { p_share: shareId, p_name: name })
    if (error) return error.message
    return (data as string | null) ?? null
  }
  return writeDemoInterest(shareId, name)
}

// ---- demo fallback: read and write the same localStorage snapshot the app uses ----
const KEY = 'imdown.demo.v2'

interface DemoSnap {
  plans: Plan[]
  shares: { id: string; planId: string; by: string }[]
  guestInterests: { shareId: string; name: string; at: string }[]
  people: Record<string, { displayName: string }>
}

function readDemo(): DemoSnap | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as DemoSnap) : null
  } catch {
    return null
  }
}

function readDemoShare(shareId: string): SharePayload | null {
  const snap = readDemo()
  const share = snap?.shares.find((s) => s.id === shareId)
  const plan = share && snap?.plans.find((p) => p.id === share.planId)
  if (!snap || !share || !plan) return null
  return {
    plan,
    by: snap.people[share.by]?.displayName ?? 'someone',
    names: snap.guestInterests.filter((g) => g.shareId === shareId).map((g) => g.name),
  }
}

function writeDemoInterest(shareId: string, name: string): string | null {
  const clean = name.trim().slice(0, 24)
  if (clean.length < 2) return 'Put a name so they know who is in.'
  const snap = readDemo()
  if (!snap || !snap.shares.some((s) => s.id === shareId)) return 'This link is not valid.'
  if (snap.guestInterests.some((g) => g.shareId === shareId && g.name.toLowerCase() === clean.toLowerCase())) return 'You are already in.'
  snap.guestInterests.push({ shareId, name: clean, at: new Date().toISOString() })
  localStorage.setItem(KEY, JSON.stringify(snap))
  return null
}
