import { useMemo } from 'react'
import type { Id, Plan, Profile } from '../types'
import { money } from '../data/logic'

interface Props {
  plan: Plan
  me: Profile
  people: Record<Id, Profile>
  friendTappers: Id[]
  iTapped: boolean
  /** Set when a hangout for this plan is already open and you are not in it yet. */
  joinable: Id | null
  guestCount: number
  demo: boolean
  onTap: () => void
  onUntap: () => void
  onJoin: () => void
  onShare: () => void
  onCopy: () => void
  onNudge: () => void
}

export function PlanCard({
  plan, me, people, friendTappers, iTapped, joinable, guestCount, demo,
  onTap, onUntap, onJoin, onShare, onCopy, onNudge,
}: Props) {
  const count = friendTappers.length + (iTapped ? 1 : 0)
  const left = Math.max(0, me.threshold - count)
  // Reading the clock to render "3d ago" is intentional; it only needs to be right at paint.
  // oxlint-disable-next-line react/purity
  const days = useMemo(() => Math.round((Date.now() - Date.parse(plan.lastDoneAt)) / 864e5), [plan.lastDoneAt])

  const status = () => {
    if (joinable) return 'your friends are going, join them'
    if (count === 0) return 'nobody yet'
    if (left > 0) return `${count} down · ${left} more to propose a time`
    return 'proposed, pick a time in Hangouts'
  }

  return (
    <article className="bg-card border border-line rounded-2xl p-4 space-y-3">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-extrabold leading-tight">{plan.title}</h3>
          <div className="text-mute text-xs mt-1">{plan.area} · {plan.bestTime}</div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-ok font-bold text-sm">{plan.doneCount}× done</div>
          <div className="text-mute text-[11px]">{days <= 0 ? 'today' : `${days}d ago`}</div>
        </div>
      </header>

      {/* The whole outing at a glance, so the card is worth copying on its own. */}
      <div className="flex items-center gap-3 text-sm font-bold">
        <span className="text-brand2">{money(plan.costPerPerson)}</span>
        <span className="text-mute font-normal">~{plan.hours}h</span>
      </div>

      <ol className="text-sm space-y-1">
        {plan.steps.map((s, i) => (
          <li key={i} className="flex gap-2"><span className="text-mute">{i + 1}.</span><span>{s}</span></li>
        ))}
      </ol>

      {plan.tips.length > 0 && (
        <ul className="text-xs text-mute space-y-1 border-l-2 border-line pl-3">
          {plan.tips.map((t, i) => <li key={i}>{t}</li>)}
        </ul>
      )}

      <div className="flex flex-wrap gap-1">
        {plan.vibe.map((v) => <span key={v} className="text-[11px] bg-card2 border border-line rounded-full px-2 py-0.5 text-mute">{v}</span>)}
      </div>

      <footer className="space-y-2 pt-1">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex -space-x-1">
              {iTapped && <span title="you" className="w-7 h-7 rounded-full bg-brand text-black grid place-items-center text-sm border-2 border-card">{me.emoji}</span>}
              {friendTappers.map((id) => (
                <span key={id} title={people[id]?.displayName} className="w-7 h-7 rounded-full bg-card2 grid place-items-center text-sm border-2 border-card">{people[id]?.emoji ?? '🙂'}</span>
              ))}
            </div>
            <span className="text-xs text-mute truncate">{status()}</span>
          </div>

          {joinable ? (
            <button onClick={onJoin} className="tap shrink-0 bg-ok text-black rounded-xl px-4 py-2 font-bold text-sm">join</button>
          ) : iTapped ? (
            <button onClick={onUntap} className="tap shrink-0 bg-card2 border border-line rounded-xl px-4 py-2 font-bold text-sm">down ✓</button>
          ) : (
            <button onClick={onTap} className="tap shrink-0 bg-brand text-black rounded-xl px-4 py-2 font-bold text-sm">I'm down</button>
          )}
        </div>

        <div className="flex items-center gap-3 text-xs text-mute">
          <button onClick={onShare} className="tap underline">send to a group chat</button>
          <button onClick={onCopy} className="tap underline">copy this plan</button>
          {guestCount > 0 && <span className="text-brand2">{guestCount} down via your link</span>}
          {demo && iTapped && left > 0 && <button onClick={onNudge} className="tap ml-auto underline opacity-60">nudge (demo)</button>}
        </div>
      </footer>
    </article>
  )
}
