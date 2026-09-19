import type { Id, Plan, Profile } from '../types'
import { CONFIRM_THRESHOLD } from '../types'

interface Props {
  plan: Plan
  me: Id
  people: Record<Id, Profile>
  friendTappers: Id[]
  iTapped: boolean
  onTap: () => void
  onUntap: () => void
}

const cost = (c: number) => '$'.repeat(c)

export function PlanCard({ plan, me, people, friendTappers, iTapped, onTap, onUntap }: Props) {
  const count = friendTappers.length + (iTapped ? 1 : 0)
  const left = Math.max(0, CONFIRM_THRESHOLD - count)
  const ago = Math.round((Date.now() - Date.parse(plan.lastDoneAt)) / 864e5)

  return (
    <article className="bg-card border border-line rounded-2xl p-4 space-y-3">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-extrabold leading-tight">{plan.title}</h3>
          <div className="text-mute text-xs mt-1">{plan.area} · {cost(plan.cost)} · ~{plan.hours}h · {plan.bestTime}</div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-ok font-bold text-sm">{plan.doneCount}× done</div>
          <div className="text-mute text-[11px]">{ago === 0 ? 'today' : `${ago}d ago`}</div>
        </div>
      </header>

      <ol className="text-sm space-y-1">
        {plan.steps.map((s, i) => (
          <li key={i} className="flex gap-2"><span className="text-mute">{i + 1}.</span><span>{s}</span></li>
        ))}
      </ol>

      <div className="flex flex-wrap gap-1">
        {plan.vibe.map((v) => <span key={v} className="text-[11px] bg-card2 border border-line rounded-full px-2 py-0.5 text-mute">{v}</span>)}
      </div>

      <footer className="flex items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex -space-x-1">
            {iTapped && <span title="you" className="w-7 h-7 rounded-full bg-brand text-black grid place-items-center text-sm border-2 border-card">{people[me]?.emoji}</span>}
            {friendTappers.map((id) => (
              <span key={id} title={people[id]?.displayName} className="w-7 h-7 rounded-full bg-card2 grid place-items-center text-sm border-2 border-card">{people[id]?.emoji ?? '🙂'}</span>
            ))}
          </div>
          <span className="text-xs text-mute truncate">
            {count === 0 ? 'nobody yet' : left > 0 ? `${count} down · ${left} more to lock it` : 'locked in, check Hangouts'}
          </span>
        </div>
        {iTapped ? (
          <button onClick={onUntap} className="tap shrink-0 bg-card2 border border-line rounded-xl px-4 py-2 font-bold text-sm">down ✓</button>
        ) : (
          <button onClick={onTap} className="tap shrink-0 bg-brand text-black rounded-xl px-4 py-2 font-bold text-sm">I'm down</button>
        )}
      </footer>
    </article>
  )
}
