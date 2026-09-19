import { useMemo, useState } from 'react'
import type { Hangout, Id, Plan, Profile } from '../types'
import { money } from '../data/logic'

interface Props {
  h: Hangout
  plan: Plan | undefined
  me: Id
  people: Record<Id, Profile>
  demo: boolean
  onVote: (slotId: Id) => void
  onSend: (text: string) => void
  onOutcome: (happened: boolean) => void
  onRecap: (note: string, photo: string | null) => void
  onCopy: () => void
  onNudgeVote: (slotId: Id) => void
}

const BADGE: Record<string, [string, string]> = {
  voting: ['picking a time', 'text-brand2'],
  confirmed: ['locked', 'text-ok'],
  done: ['happened ✓', 'text-ok'],
  flopped: ['flopped', 'text-mute'],
}

export function HangoutCard({ h, plan, me, people, demo, onVote, onSend, onOutcome, onRecap, onCopy, onNudgeVote }: Props) {
  const [text, setText] = useState('')
  const [note, setNote] = useState('')
  const [photo, setPhoto] = useState<string | null>(null)
  // Stay expanded while there is still something to do, including an unwritten recap.
  const [open, setOpen] = useState(h.status === 'voting' || h.status === 'confirmed' || (h.status === 'done' && !h.recap))

  const chosen = h.slots.find((s) => s.id === h.chosenSlotId)
  // Reading the clock to ask "is this night already behind us" is intentional.
  // oxlint-disable-next-line react/purity
  const past = useMemo(() => (chosen ? Date.parse(chosen.at) < Date.now() : false), [chosen])
  const settled = h.status === 'done' || h.status === 'flopped'
  const [label, color] = BADGE[h.status]
  const need = Math.floor(h.members.length / 2) + 1

  const pickPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    const r = new FileReader()
    r.onload = () => setPhoto(String(r.result))
    r.readAsDataURL(f)
  }

  return (
    <article className="bg-card border border-line rounded-2xl p-4 space-y-3">
      <header className="flex items-start justify-between gap-3 cursor-pointer" onClick={() => setOpen((o) => !o)}>
        <div className="min-w-0">
          <h3 className="font-extrabold truncate">{plan?.title ?? 'Plan'}</h3>
          <div className={`text-xs font-bold ${color}`}>
            {h.status === 'confirmed' && chosen ? `locked: ${chosen.label}` : label}
          </div>
        </div>
        <div className="flex -space-x-1 shrink-0">
          {h.members.map((id) => (
            <span key={id} className={`w-7 h-7 rounded-full grid place-items-center text-sm border-2 border-card ${id === me ? 'bg-brand text-black' : 'bg-card2'}`}>
              {people[id]?.emoji ?? '🙂'}
            </span>
          ))}
        </div>
      </header>

      {open && (
        <>
          {h.status === 'voting' && (
            <div className="space-y-2">
              <div className="text-xs text-mute">
                Proposed, not locked. {need} of {h.members.length} on the same night confirms it.
              </div>
              {h.slots.map((s) => {
                const mine = s.votes.includes(me)
                return (
                  <div key={s.id} className="flex items-center gap-2">
                    <button onClick={() => onVote(s.id)} className={`tap flex-1 flex items-center justify-between rounded-xl px-4 py-3 border ${mine ? 'border-brand bg-brand/10' : 'border-line bg-card2'}`}>
                      <span className="font-bold">{s.label}</span>
                      <span className="flex -space-x-1">
                        {s.votes.map((v) => (
                          <span key={v} className="w-6 h-6 rounded-full bg-card grid place-items-center text-xs border border-line">{people[v]?.emoji}</span>
                        ))}
                      </span>
                    </button>
                    {demo && <button onClick={() => onNudgeVote(s.id)} className="tap text-[11px] text-mute underline opacity-60">nudge</button>}
                  </div>
                )
              })}
            </div>
          )}

          {h.status === 'confirmed' && plan && (
            <div className="space-y-2">
              <div className="text-sm space-y-0.5">
                {plan.steps.map((s, i) => <div key={i} className="text-mute">{i + 1}. {s}</div>)}
                <div className="text-brand2 font-bold pt-1">{money(plan.costPerPerson)}</div>
              </div>
              <div className="text-xs text-mute">{past ? 'This was scheduled for earlier. Did it happen?' : 'After you go, mark it so it counts.'}</div>
              <div className="flex gap-2">
                <button onClick={() => onOutcome(true)} className="tap flex-1 bg-ok text-black font-bold rounded-xl py-2">We did it</button>
                <button onClick={() => onOutcome(false)} className="tap flex-1 bg-card2 border border-line rounded-xl py-2 text-mute">Flopped</button>
              </div>
            </div>
          )}

          {/* A recap is the cheapest way to put a proven plan back into the feed. */}
          {h.status === 'done' && !h.recap && (
            <div className="space-y-2">
              <div className="text-xs text-mute">Add one line and a photo. That is what makes the card worth copying.</div>
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="how it went" className="w-full bg-card2 border border-line rounded-xl px-3 py-2 text-sm outline-none focus:border-brand" />
              {photo && <img src={photo} alt="" className="rounded-xl max-h-40 w-full object-cover" />}
              <div className="flex gap-2">
                <label className="tap flex-1 bg-card2 border border-line rounded-xl py-2 text-sm text-center text-mute cursor-pointer">
                  add photo
                  <input type="file" accept="image/*" className="hidden" onChange={pickPhoto} />
                </label>
                <button onClick={() => onRecap(note.trim(), photo)} disabled={!note.trim() && !photo} className="tap flex-1 bg-brand text-black font-bold rounded-xl py-2 disabled:opacity-40">Post recap</button>
              </div>
            </div>
          )}

          {h.recap && (
            <div className="space-y-2 bg-card2 rounded-xl p-3">
              {h.recap.photo && <img src={h.recap.photo} alt="" className="rounded-lg max-h-40 w-full object-cover" />}
              {h.recap.note && <div className="text-sm">{h.recap.note}</div>}
              <button onClick={onCopy} className="tap text-xs text-brand font-bold underline">Copy this plan</button>
            </div>
          )}

          <div className="space-y-2 pt-1">
            <div className="max-h-40 overflow-y-auto space-y-1">
              {h.messages.length === 0 && <div className="text-xs text-mute">No messages yet. Say when you can leave.</div>}
              {h.messages.map((m) => (
                <div key={m.id} className={`text-sm ${m.userId === me ? 'text-right' : ''}`}>
                  <span className="text-mute text-xs mr-1">{people[m.userId]?.displayName}</span>
                  <span className="inline-block bg-card2 rounded-xl px-3 py-1">{m.text}</span>
                </div>
              ))}
            </div>
            {!settled && (
              <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (text.trim()) { onSend(text.trim()); setText('') } }}>
                <input value={text} onChange={(e) => setText(e.target.value)} placeholder="message the group" className="flex-1 bg-card2 border border-line rounded-xl px-3 py-2 text-sm outline-none focus:border-brand" />
                <button className="tap bg-card2 border border-line rounded-xl px-3 text-sm font-bold">send</button>
              </form>
            )}
          </div>
        </>
      )}
    </article>
  )
}
