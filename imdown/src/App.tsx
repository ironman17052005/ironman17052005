import { useEffect, useMemo, useState } from 'react'
import { useStore } from './data/useStore'
import { friendTaps, rankFeed } from './data/logic'
import { DemoStore } from './data/demoStore'
import { Auth } from './components/Auth'
import { PlanCard } from './components/PlanCard'
import { HangoutCard } from './components/HangoutCard'
import { FriendsPanel } from './components/FriendsPanel'
import { AddPlanSheet } from './components/AddPlanSheet'
import { supabase } from './lib/supabase'

type Tab = 'feed' | 'hangouts' | 'friends'

export default function App() {
  const { mode, store, snap, needsAuth, error } = useStore()
  const [tab, setTab] = useState<Tab>('feed')
  const [adding, setAdding] = useState(false)
  const [filter, setFilter] = useState<string | null>(null)

  // Invite links: /?add=username
  useEffect(() => {
    const u = new URLSearchParams(window.location.search).get('add')
    if (u && store && snap) {
      store.addFriend(u).then(() => history.replaceState(null, '', window.location.pathname))
    }
  }, [store, snap])

  const feed = useMemo(() => {
    if (!snap) return []
    const ranked = rankFeed(snap.plans, snap.taps, snap.friends)
    return filter ? ranked.filter((p) => p.vibe.includes(filter)) : ranked
  }, [snap, filter])

  if (needsAuth) return <Auth />
  if (error) return <div className="p-6 text-brand">{error}</div>
  if (!snap || !store) return <div className="p-6 text-mute">loading…</div>

  const open = snap.hangouts.filter((h) => h.status === 'voting' || h.status === 'confirmed')
  const closed = snap.hangouts.filter((h) => h.status === 'done' || h.status === 'flopped')
  const vibes = Array.from(new Set(snap.plans.flatMap((p) => p.vibe)))

  return (
    <div className="min-h-full max-w-md mx-auto flex flex-col">
      <header className="sticky top-0 z-10 bg-bg/90 backdrop-blur border-b border-line px-4 py-3 flex items-center justify-between">
        <div>
          <div className="text-xl font-black leading-none">i'm down</div>
          <div className="text-[11px] text-mute">plans your friends actually did</div>
        </div>
        <div className="flex items-center gap-2">
          {mode === 'demo' && (
            <button onClick={() => (store as DemoStore).reset()} className="text-[11px] text-mute underline">reset demo</button>
          )}
          {mode === 'live' && <button onClick={() => supabase?.auth.signOut()} className="text-[11px] text-mute underline">sign out</button>}
          <button onClick={() => setAdding(true)} className="tap bg-card2 border border-line rounded-xl px-3 py-1.5 text-sm font-bold">+ plan</button>
        </div>
      </header>

      {mode === 'demo' && (
        <div className="mx-4 mt-3 text-[11px] text-mute bg-card border border-line rounded-xl px-3 py-2">
          Demo mode. Your friends are simulated: tap a plan and watch them pile in. Add Supabase keys to go live.
        </div>
      )}

      <main className="flex-1 px-4 py-4 space-y-3 pb-24">
        {tab === 'feed' && (
          <>
            <div className="flex gap-1 overflow-x-auto pb-1 -mx-4 px-4">
              <button onClick={() => setFilter(null)} className={`shrink-0 text-xs rounded-full px-3 py-1 border ${!filter ? 'border-brand text-brand' : 'border-line text-mute'}`}>all</button>
              {vibes.map((v) => (
                <button key={v} onClick={() => setFilter(v === filter ? null : v)} className={`shrink-0 text-xs rounded-full px-3 py-1 border ${filter === v ? 'border-brand text-brand' : 'border-line text-mute'}`}>{v}</button>
              ))}
            </div>
            {feed.map((p) => (
              <PlanCard
                key={p.id}
                plan={p}
                me={snap.me.id}
                people={snap.people}
                friendTappers={friendTaps(snap.taps, p.id, snap.friends)}
                iTapped={snap.taps.some((t) => t.planId === p.id && t.userId === snap.me.id)}
                onTap={() => store.tap(p.id)}
                onUntap={() => store.untap(p.id)}
              />
            ))}
          </>
        )}

        {tab === 'hangouts' && (
          <>
            {open.length === 0 && (
              <div className="text-mute text-sm bg-card border border-line rounded-2xl p-4">
                Nothing locked yet. When you and two friends are down for the same plan, it shows up here with times to vote on.
              </div>
            )}
            {open.map((h) => (
              <HangoutCard key={h.id} h={h} plan={snap.plans.find((p) => p.id === h.planId)} me={snap.me.id} people={snap.people}
                onVote={(s) => store.voteTime(h.id, s)} onSend={(t) => store.sendMessage(h.id, t)} onOutcome={(ok) => store.markOutcome(h.id, ok)} />
            ))}
            {closed.length > 0 && <div className="text-xs text-mute pt-2">Past</div>}
            {closed.map((h) => (
              <HangoutCard key={h.id} h={h} plan={snap.plans.find((p) => p.id === h.planId)} me={snap.me.id} people={snap.people}
                onVote={() => {}} onSend={() => {}} onOutcome={() => {}} />
            ))}
          </>
        )}

        {tab === 'friends' && (
          <FriendsPanel me={snap.me} friends={snap.friends} people={snap.people} onAdd={(u) => store.addFriend(u)} mode={mode} />
        )}
      </main>

      <nav className="fixed bottom-0 inset-x-0 z-10 bg-bg/95 backdrop-blur border-t border-line">
        <div className="max-w-md mx-auto grid grid-cols-3">
          {(['feed', 'hangouts', 'friends'] as Tab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`py-3 text-sm font-bold ${tab === t ? 'text-brand' : 'text-mute'}`}>
              {t}{t === 'hangouts' && open.length > 0 ? ` (${open.length})` : ''}
            </button>
          ))}
        </div>
      </nav>

      {adding && <AddPlanSheet onClose={() => setAdding(false)} onCreate={(p) => store.createPlan(p)} />}
    </div>
  )
}
