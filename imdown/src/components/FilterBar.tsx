import { useState } from 'react'
import { isFiltered, type Filters, type Sort } from '../data/logic'

interface Props {
  filters: Filters
  vibes: string[]
  resultCount: number
  savedCount: number
  onChange: (f: Filters) => void
  onReset: () => void
  onSurprise: () => void
}

const SORTS: { id: Sort; label: string }[] = [
  { id: 'for-you', label: 'for you' },
  { id: 'proven', label: 'most done' },
  { id: 'new', label: 'recent' },
  { id: 'cheap', label: 'cheapest' },
  { id: 'quick', label: 'quickest' },
]

const COSTS = [10, 20, 40]
const HOURS = [2, 3, 5]

const chip = (on: boolean) =>
  `tap shrink-0 text-xs rounded-full px-3 py-1 border transition-colors ${on ? 'border-brand text-brand bg-brand/10' : 'border-line text-mute'}`

export function FilterBar({ filters, vibes, resultCount, savedCount, onChange, onReset, onSurprise }: Props) {
  const [open, setOpen] = useState(false)
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch })
  const toggleVibe = (v: string) =>
    set({ vibes: filters.vibes.includes(v) ? filters.vibes.filter((x) => x !== v) : [...filters.vibes, v] })
  const active = isFiltered(filters)

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            value={filters.q}
            onChange={(e) => set({ q: e.target.value })}
            placeholder="karaoke, cheap, chinatown…"
            aria-label="Search plans"
            className="w-full bg-card2 border border-line rounded-xl pl-9 pr-8 py-2.5 text-sm outline-none focus:border-brand"
          />
          <span aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 text-mute text-sm">⌕</span>
          {filters.q && (
            <button onClick={() => set({ q: '' })} aria-label="Clear search" className="tap absolute right-2 top-1/2 -translate-y-1/2 text-mute px-1">×</button>
          )}
        </div>
        <button onClick={onSurprise} title="Pick something for tonight" className="tap shrink-0 bg-card2 border border-line rounded-xl px-3 font-bold text-sm">
          🎲
        </button>
      </div>

      <div className="flex gap-1 overflow-x-auto -mx-4 px-4 pb-0.5">
        <button onClick={() => set({ tonightOnly: !filters.tonightOnly })} className={chip(filters.tonightOnly)}>tonight</button>
        {savedCount > 0 && (
          <button onClick={() => set({ savedOnly: !filters.savedOnly })} className={chip(filters.savedOnly)}>saved ({savedCount})</button>
        )}
        <button onClick={() => setOpen((o) => !o)} className={chip(open || filters.maxCost !== null || filters.maxHours !== null || filters.vibes.length > 0)}>
          filters{filters.vibes.length ? ` (${filters.vibes.length})` : ''} {open ? '▴' : '▾'}
        </button>
        {SORTS.map((s) => (
          <button key={s.id} onClick={() => set({ sort: s.id })} className={chip(filters.sort === s.id && !filters.q)} disabled={!!filters.q}>
            {s.label}
          </button>
        ))}
      </div>

      {open && (
        <div className="space-y-2 bg-card border border-line rounded-2xl p-3">
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-[11px] text-mute w-14">under</span>
            {COSTS.map((c) => (
              <button key={c} onClick={() => set({ maxCost: filters.maxCost === c ? null : c })} className={chip(filters.maxCost === c)}>${c}</button>
            ))}
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-[11px] text-mute w-14">under</span>
            {HOURS.map((h) => (
              <button key={h} onClick={() => set({ maxHours: filters.maxHours === h ? null : h })} className={chip(filters.maxHours === h)}>{h}h</button>
            ))}
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-[11px] text-mute w-14">vibe</span>
            {vibes.map((v) => (
              <button key={v} onClick={() => toggleVibe(v)} className={chip(filters.vibes.includes(v))}>{v}</button>
            ))}
          </div>
        </div>
      )}

      {active && (
        <div className="flex items-center justify-between text-[11px] text-mute">
          <span>{resultCount} {resultCount === 1 ? 'plan' : 'plans'}</span>
          <button onClick={onReset} className="tap underline">clear all</button>
        </div>
      )}
    </div>
  )
}
