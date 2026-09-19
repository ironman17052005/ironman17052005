import { useState } from 'react'
import type { Hangout, Id, Plan, Profile } from '../types'

interface Props {
  h: Hangout
  plan: Plan | undefined
  me: Id
  people: Record<Id, Profile>
  onVote: (slotId: Id) => void
  onSend: (text: string) => void
  onOutcome: (happened: boolean) => void
}

export function HangoutCard({ h, plan, me, people, onVote, onSend, onOutcome }: Props) {
  const [text, setText] = useState('')
  const [open, setOpen] = useState(h.status !== 'done' && h.status !== 'flopped')
  const chosen = h.slots.find((s) => s.id === h.chosenSlotId)
  const past = chosen ? Date.parse(chosen.at) < Date.now() : false

  const badge = {
    voting: ['picking a time', 'text-brand2'],
    confirmed: [chosen ? `locked: ${chosen.label}` : 'locked', 'text-ok'],
    done: ['happened ✓', 'text-ok'],
    flopped: ['flopped', 'text-mute'],
  }[h.status]

  return (
    <article className="bg-card border border-line rounded-2xl p-4 space-y-3">
      <header className="flex items-start justify-between gap-3" onClick={() => setOpen((o) => !o)}>
        <div>
          <h3 className="font-extrabold">{plan?.title ?? 'Plan'}</h3>
          <div className={`text-xs font-bold ${badge[1]}`}>{badge[0]}</div>
        </div>
        <div className="flex -space-x-1">
          {h.members.map((id) => (
            <span key={id} className={`w-7 h-7 rounded-full grid place-items-center text-sm border-2 border-card ${id === me ? 'bg-brand text-black' : 'bg-card2'}`}>{people[id]?.emoji ?? '🙂'}</span>
          ))}
        </div>
      </header>

      {open && (
        <>
          {h.status === 'voting' && (
            <div className="space-y-2">
              <div className="text-xs text-mute">Pick a time. Majority wins.</div>
              {h.slots.map((s) => {
                const mine = s.votes.includes(me)
                return (
                  <button key={s.id} onClick={() => onVote(s.id)} className={`tap w-full flex items-center justify-between rounded-xl px-4 py-3 border ${mine ? 'border-brand bg-brand/10' : 'border-line bg-card2'}`}>
                    <span className="font-bold">{s.label}</span>
                    <span className="flex -space-x-1">
                      {s.votes.map((v) => <span key={v} className="w-6 h-6 rounded-full bg-card grid place-items-center text-xs border border-line">{people[v]?.emoji}</span>)}
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          {h.status === 'confirmed' && (
            <div className="space-y-2">
              <div className="text-sm">
                {plan?.steps.map((s, i) => <div key={i} className="text-mute">{i + 1}. {s}</div>)}
              </div>
              <div className="text-xs text-mute">{past ? 'This was scheduled for earlier. Did it happen?' : 'After you go, mark it so it counts.'}</div>
              <div className="flex gap-2">
                <button onClick={() => onOutcome(true)} className="tap flex-1 bg-ok text-black font-bold rounded-xl py-2">We did it</button>
                <button onClick={() => onOutcome(false)} className="tap flex-1 bg-card2 border border-line rounded-xl py-2 text-mute">Flopped</button>
              </div>
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
            {(h.status === 'voting' || h.status === 'confirmed') && (
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
