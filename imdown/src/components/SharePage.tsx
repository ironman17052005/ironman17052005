import { useCallback, useEffect, useState } from 'react'
import { addInterest, fetchShare, type SharePayload } from '../data/shareApi'
import { money } from '../data/logic'

/**
 * What a friend sees when they tap the link in the group chat. No account, no
 * app. It shows the outing and who is already in, and takes a first name.
 * It deliberately shows nothing else about the sharer.
 */
export function SharePage({ shareId }: { shareId: string }) {
  const [data, setData] = useState<SharePayload | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading')
  const [name, setName] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [joined, setJoined] = useState(false)

  const pull = useCallback(
    () =>
      fetchShare(shareId)
        .then((d) => { setData(d); setState(d ? 'ready' : 'missing') })
        .catch((e) => { setErr(e instanceof Error ? e.message : String(e)); setState('missing') }),
    [shareId],
  )

  useEffect(() => { void pull() }, [pull])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const problem = await addInterest(shareId, name)
    if (problem) return setErr(problem)
    setErr(null)
    setJoined(true)
    setName('')
    await pull()
  }

  if (state === 'loading') return <div className="p-6 text-mute">loading…</div>

  if (state === 'missing') {
    return (
      <div className="min-h-full grid place-items-center p-6 text-center">
        <div className="space-y-2">
          <div className="text-2xl font-black">link expired</div>
          <p className="text-mute text-sm">{err ?? 'This plan link is not valid any more.'}</p>
          <a href="/" className="tap inline-block bg-brand text-black font-bold rounded-xl px-5 py-2.5">open i'm down</a>
        </div>
      </div>
    )
  }

  const { plan, names, by } = data!

  return (
    <div className="min-h-full max-w-md mx-auto p-5 space-y-4">
      <div className="text-center">
        <div className="text-xl font-black">i'm down</div>
        <div className="text-xs text-mute">{by} sent you this</div>
      </div>

      <article className="bg-card border border-line rounded-2xl p-4 space-y-3">
        <div>
          <h1 className="text-2xl font-black leading-tight">{plan.title}</h1>
          <div className="text-mute text-xs mt-1">{plan.area} · {plan.bestTime}</div>
        </div>
        <div className="flex items-center gap-3 text-sm font-bold">
          <span className="text-brand2">{money(plan.costPerPerson)}</span>
          <span className="text-mute font-normal">~{plan.hours}h</span>
          <span className="text-ok ml-auto">{plan.doneCount}× done</span>
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
      </article>

      <div className="bg-card border border-line rounded-2xl p-4 space-y-3">
        <div className="text-sm">
          {names.length === 0 ? (
            <span className="text-mute">Nobody is in yet. Be first.</span>
          ) : (
            <span><span className="font-bold">{names.join(', ')}</span> <span className="text-mute">{names.length === 1 ? 'is' : 'are'} in</span></span>
          )}
        </div>

        {joined ? (
          <div className="text-ok font-bold text-sm">You're in. {by} will sort out the time.</div>
        ) : (
          <form onSubmit={submit} className="flex gap-2">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="your first name" maxLength={24} className="flex-1 bg-card2 border border-line rounded-xl px-3 py-2.5 outline-none focus:border-brand" />
            <button className="tap bg-brand text-black font-bold rounded-xl px-5">I'm down</button>
          </form>
        )}
        {err && <div className="text-brand text-xs">{err}</div>}
        <div className="text-[11px] text-mute">No account needed. Your name is only visible to people with this link.</div>
      </div>

      <a href="/" className="tap block text-center text-xs text-mute underline">see more plans like this</a>
    </div>
  )
}
