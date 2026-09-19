import { useState } from 'react'
import type { Plan } from '../types'

interface Props {
  onClose: () => void
  onCreate: (p: Omit<Plan, 'id' | 'doneCount' | 'lastDoneAt' | 'createdBy'>) => Promise<void>
}

const VIBES = ['food', 'late night', 'sport', 'chill', 'games', 'outdoors', 'walk', 'drinks', 'road trip', 'home']

/** Posting has to be fast or nobody does it, but cost and one tip are what make a card copyable. */
export function AddPlanSheet({ onClose, onCreate }: Props) {
  const [title, setTitle] = useState('')
  const [steps, setSteps] = useState('')
  const [area, setArea] = useState('Houston')
  const [vibe, setVibe] = useState<string[]>([])
  const [cost, setCost] = useState('20')
  const [hours, setHours] = useState(3)
  const [bestTime, setBestTime] = useState('Sat night')
  const [tips, setTips] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const ok = title.trim().length > 2 && steps.trim().length > 2

  const submit = async () => {
    if (!ok || busy) return
    setBusy(true)
    setErr(null)
    try {
      await onCreate({
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
      <div className="w-full max-w-md bg-card border border-line rounded-t-3xl sm:rounded-3xl p-5 space-y-3 max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black">Post a plan you did</h2>
          <button onClick={onClose} className="text-mute">close</button>
        </div>
        <p className="text-xs text-mute">Only outings that actually happened. Strangers see the plan, never who went.</p>

        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Hot pot then karaoke" className="w-full bg-card2 border border-line rounded-xl px-3 py-2 outline-none focus:border-brand" />
        <textarea value={steps} onChange={(e) => setSteps(e.target.value)} rows={3} placeholder={'One step per line\nHot pot at Tan Tan\nKaraoke at KBox'} className="w-full bg-card2 border border-line rounded-xl px-3 py-2 outline-none focus:border-brand text-sm" />
        <textarea value={tips} onChange={(e) => setTips(e.target.value)} rows={2} placeholder={'One tip per line (optional)\nPut your name down at KBox before you eat'} className="w-full bg-card2 border border-line rounded-xl px-3 py-2 outline-none focus:border-brand text-sm" />

        <div className="grid grid-cols-2 gap-2">
          <input value={area} onChange={(e) => setArea(e.target.value)} placeholder="Area" className="bg-card2 border border-line rounded-xl px-3 py-2 outline-none focus:border-brand text-sm" />
          <input value={bestTime} onChange={(e) => setBestTime(e.target.value)} placeholder="Best time" className="bg-card2 border border-line rounded-xl px-3 py-2 outline-none focus:border-brand text-sm" />
        </div>

        <div className="flex items-center gap-2 text-sm">
          <span className="text-mute">$ per person</span>
          <input type="number" min={0} max={999} value={cost} onChange={(e) => setCost(e.target.value)} className="w-20 bg-card2 border border-line rounded-lg px-2 py-1" />
          <span className="text-mute ml-auto">Hours</span>
          <input type="number" min={1} max={12} value={hours} onChange={(e) => setHours(Number(e.target.value))} className="w-16 bg-card2 border border-line rounded-lg px-2 py-1" />
        </div>

        <div className="flex flex-wrap gap-1">
          {VIBES.map((v) => (
            <button key={v} onClick={() => setVibe((x) => (x.includes(v) ? x.filter((y) => y !== v) : [...x, v]))} className={`tap text-xs rounded-full px-3 py-1 border ${vibe.includes(v) ? 'border-brand text-brand' : 'border-line text-mute'}`}>{v}</button>
          ))}
        </div>

        {err && <div className="text-brand text-sm">{err}</div>}
        <button disabled={!ok || busy} onClick={submit} className="tap w-full bg-brand text-black font-bold rounded-xl py-3 disabled:opacity-40">
          {busy ? 'posting…' : 'Post it'}
        </button>
      </div>
    </div>
  )
}
