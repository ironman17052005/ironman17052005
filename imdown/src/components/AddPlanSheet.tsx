import { useEffect, useRef, useState } from 'react'
import type { Plan, PlanInput } from '../types'

export type SheetMode =
  | { kind: 'new' }
  | { kind: 'copy'; from: Plan }
  | { kind: 'edit'; plan: Plan }

interface Props {
  mode: SheetMode
  existingTitles: string[]
  onClose: () => void
  onSubmit: (p: PlanInput) => Promise<void>
}

const VIBES = ['food', 'late night', 'sport', 'chill', 'games', 'outdoors', 'walk', 'drinks', 'road trip', 'home']

const seedFrom = (mode: SheetMode): Plan | null =>
  mode.kind === 'copy' ? mode.from : mode.kind === 'edit' ? mode.plan : null

/**
 * One sheet for three jobs: posting an outing you did, copying someone else's as a
 * starting point, and fixing a typo in your own. Copying prefills rather than
 * cloning, so the feed does not fill up with near-identical cards nobody edited.
 */
export function AddPlanSheet({ mode, existingTitles, onClose, onSubmit }: Props) {
  const seed = seedFrom(mode)
  const [title, setTitle] = useState(seed?.title ?? '')
  const [steps, setSteps] = useState(seed?.steps.join('\n') ?? '')
  const [area, setArea] = useState(seed?.area ?? 'Houston')
  const [vibe, setVibe] = useState<string[]>(seed?.vibe ?? [])
  const [cost, setCost] = useState(String(seed?.costPerPerson ?? 20))
  const [hours, setHours] = useState(seed?.hours ?? 3)
  const [bestTime, setBestTime] = useState(seed?.bestTime ?? 'Sat night')
  const [tips, setTips] = useState(seed?.tips.join('\n') ?? '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const firstField = useRef<HTMLInputElement>(null)

  useEffect(() => {
    firstField.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const ok = title.trim().length > 2 && steps.trim().length > 2
  const clash =
    mode.kind !== 'edit' &&
    title.trim().length > 2 &&
    existingTitles.some((t) => t.toLowerCase() === title.trim().toLowerCase())

  const heading = mode.kind === 'edit' ? 'Edit your plan' : mode.kind === 'copy' ? 'Make it yours' : 'Post a plan you did'
  const blurb =
    mode.kind === 'edit'
      ? 'Changes show up everywhere this card appears.'
      : mode.kind === 'copy'
        ? 'Change what you did differently, then post it as your own.'
        : 'Only outings that actually happened. Strangers see the plan, never who went.'

  const submit = async () => {
    if (!ok || busy) return
    setBusy(true)
    setErr(null)
    try {
      await onSubmit({
        title: title.trim(),
        steps: steps.split('\n').map((s) => s.trim()).filter(Boolean),
        area: area.trim(),
        vibe,
        costPerPerson: Math.max(0, Number(cost) || 0),
        hours,
        bestTime: bestTime.trim(),
        tips: tips.split('\n').map((s) => s.trim()).filter(Boolean),
      })
      onClose()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-20 bg-black/70 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={heading}
        className="w-full max-w-md bg-card border border-line rounded-t-3xl sm:rounded-3xl p-5 space-y-3 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black">{heading}</h2>
          <button onClick={onClose} className="text-mute">close</button>
        </div>
        <p className="text-xs text-mute">{blurb}</p>

        <input ref={firstField} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Hot pot then karaoke" aria-label="Title" className="w-full bg-card2 border border-line rounded-xl px-3 py-2 outline-none focus:border-brand" />
        {clash && <div className="text-brand2 text-xs">A plan with this exact title already exists. Tweak it so people can tell them apart.</div>}

        <textarea value={steps} onChange={(e) => setSteps(e.target.value)} rows={3} aria-label="Steps, one per line" placeholder={'One step per line\nHot pot at Tan Tan\nKaraoke at KBox'} className="w-full bg-card2 border border-line rounded-xl px-3 py-2 outline-none focus:border-brand text-sm" />
        <textarea value={tips} onChange={(e) => setTips(e.target.value)} rows={2} aria-label="Tips, one per line" placeholder={'One tip per line (optional)\nPut your name down at KBox before you eat'} className="w-full bg-card2 border border-line rounded-xl px-3 py-2 outline-none focus:border-brand text-sm" />

        <div className="grid grid-cols-2 gap-2">
          <input value={area} onChange={(e) => setArea(e.target.value)} aria-label="Area" placeholder="Area" className="bg-card2 border border-line rounded-xl px-3 py-2 outline-none focus:border-brand text-sm" />
          <input value={bestTime} onChange={(e) => setBestTime(e.target.value)} aria-label="Best time" placeholder="Best time" className="bg-card2 border border-line rounded-xl px-3 py-2 outline-none focus:border-brand text-sm" />
        </div>

        <div className="flex items-center gap-2 text-sm">
          <span className="text-mute">$ per person</span>
          <input type="number" min={0} max={999} value={cost} onChange={(e) => setCost(e.target.value)} aria-label="Cost per person" className="w-20 bg-card2 border border-line rounded-lg px-2 py-1" />
          <span className="text-mute ml-auto">Hours</span>
          <input type="number" min={1} max={12} value={hours} onChange={(e) => setHours(Number(e.target.value))} aria-label="Hours" className="w-16 bg-card2 border border-line rounded-lg px-2 py-1" />
        </div>

        <div className="flex flex-wrap gap-1">
          {VIBES.map((v) => (
            <button key={v} onClick={() => setVibe((x) => (x.includes(v) ? x.filter((y) => y !== v) : [...x, v]))} aria-pressed={vibe.includes(v)} className={`tap text-xs rounded-full px-3 py-1 border ${vibe.includes(v) ? 'border-brand text-brand' : 'border-line text-mute'}`}>{v}</button>
          ))}
        </div>

        {err && <div className="text-brand text-sm">{err}</div>}
        <button disabled={!ok || busy} onClick={submit} className="tap w-full bg-brand text-black font-bold rounded-xl py-3 disabled:opacity-40">
          {busy ? 'saving…' : mode.kind === 'edit' ? 'Save changes' : 'Post it'}
        </button>
      </div>
    </div>
  )
}
