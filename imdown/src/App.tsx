import { useMemo, useState } from 'react'
import { useStore } from './data/useStore'
import { friendTaps, openHangoutFor, rankFeed } from './data/logic'
import { DemoStore } from './data/demoStore'
import { Auth } from './components/Auth'
import { PlanCard } from './components/PlanCard'
import { HangoutCard } from './components/HangoutCard'
import { FriendsPanel } from './components/FriendsPanel'
import { AddPlanSheet } from './components/AddPlanSheet'
import { ShareSheet } from './components/ShareSheet'
import { SharePage } from './components/SharePage'
import { supabase } from './lib/supabase'
import type { Plan } from './types'

type Tab = 'feed' | 'hangouts' | 'friends'

/** A share link is the one route that must work signed out, so it is checked first. */
const sharedId = new URLSearchParams(window.location.search).get('s')

export default function App() {
  if (sharedId) return <SharePage shareId={sharedId} />
  return <Main />
}

function Main() {
  const { mode, store, snap, needsAuth, error, clearError } = useStore()
  const [tab, setTab] = useState<Tab>('feed')
  const [adding, setAdding] = useState(false)
  const [filter, setFilter] = useState<string | null>(null)
  const [sharing, setSharing] = useState<{ plan: Plan; url: string } | null>(null)

  const feed = useMemo(() => {
    if (!snap) return []
    const ranked = rankFeed(snap.plans, snap.taps, snap.friends)
    return filter ? ranked.filter((p) => p.vibe.includes(filter)) : ranked
  }, [snap, filter])

  if (needsAuth) return <Auth />
  if (!snap || !store) {
    return <div className="p-6 text-mute">{error ? <span className="text-brand">{error}</span> : 'loading…'}</div>
  }

  const demo = mode === 'demo'
  const open = snap.hangouts.filter((h) => h.status === 'voting' || h.status === 'confirmed')
  const closed = snap.hangouts.filter((h) => h.status === 'done' || h.status === 'flopped')
  const vibes = Array.from(new Set(snap.plans.flatMap((p) => p.vibe)))
  const planOf = (id: string) => snap.plans.find((p) => p.id === id)

  const share = async (plan: Plan) => {
    const id = await store.createShare(plan.id)
    setSharing({ plan, url: `${window.location.origin}${window.location.pathname}?s=${id}` })
  }

  return (
    <div className="min-h-full max-w-md mx-auto flex flex-col">
      <header className="sticky top-0 z-10 bg-bg/90 backdrop-blur border-b border-line px-4 py-3 flex items-center justify-between">
        <div>
          <div className="text-xl font-black leading-none">i'm down</div>
          <div className="text-[11px] text-mute">plans your friends actually did</div>
        </div>
        <div className="flex items-center gap-2">
          {demo && <button onClick={() => (store as unknown as DemoStore).reset()} className="text-[11px] text-mute underline">reset</button>}
          {!demo && <button onClick={() => void supabase?.auth.signOut()} className="text-[11px] text-mute underline">sign out</button>}
          <button onClick={() => setAdding(true)} className="tap bg-card2 border border-line rounded-xl px-3 py-1.5 text-sm font-bold">+ plan</button>
        </div>
      </header>

      {error && (
        <div className="mx-4 mt-3 flex items-start gap-2 text-xs bg-brand/10 border border-brand rounded-xl px-3 py-2">
          <span className="flex-1 text-brand">{error}</span>
          <button onClick={clearError} className="text-brand font-bold">dismiss</button>
        </div>
      )}

      {demo && (
        <div className="mx-4 mt-3 text-[11px] text-mute bg-card border border-line rounded-xl px-3 py-2">
          Demo mode. The other people are simulated and deliberately flaky: about half reply, some never vote.
          That is the real problem this app has to solve. Use "nudge" to force a reply.
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

            {feed.map((p) => {
              const hangout = openHangoutFor(snap, p.id, [snap.me.id, ...snap.friends])
              const joinable = hangout && !hangout.members.includes(snap.me.id) ? hangout.id : null
              const shareIds = snap.shares.filter((s) => s.planId === p.id && s.by === snap.me.id).map((s) => s.id)
              return (
                <PlanCard
                  key={p.id}
                  plan={p}
                  me={snap.me}
                  people={snap.people}
                  friendTappers={friendTaps(snap.taps, p.id, snap.friends)}
                  iTapped={snap.taps.some((t) => t.planId === p.id && t.userId === snap.me.id)}
                  joinable={joinable}
                  guestCount={snap.guestInterests.filter((g) => shareIds.includes(g.shareId)).length}
                  demo={demo}
                  onTap={() => void store.tap(p.id)}
                  onUntap={() => void store.untap(p.id)}
                  onJoin={() => joinable && void store.joinHangout(joinable)}
                  onShare={() => void share(p)}
                  onCopy={() => void store.copyPlan(p.id)}
                  onNudge={() => (store as unknown as DemoStore).nudge(p.id)}
                />
              )
            })}
          </>
        )}

        {tab === 'hangouts' && (
          <>
            {open.length === 0 && (
              <div className="text-mute text-sm bg-card border border-line rounded-2xl p-4">
                Nothing proposed yet. When {snap.me.threshold} of you are down for the same plan, it lands here with times to vote on.
              </div>
            )}
            {open.map((h) => (
              <HangoutCard
                key={h.id} h={h} plan={planOf(h.planId)} me={snap.me.id} people={snap.people} demo={demo}
                onVote={(s) => void store.voteTime(h.id, s)}
                onSend={(t) => void store.sendMessage(h.id, t)}
                onOutcome={(ok) => void store.markOutcome(h.id, ok)}
                onRecap={(n, p) => void store.addRecap(h.id, n, p)}
                onCopy={() => void store.copyPlan(h.planId)}
                onNudgeVote={(s) => (store as unknown as DemoStore).nudgeVote(h.id, s)}
              />
            ))}

            {closed.length > 0 && <div className="text-xs text-mute pt-2">Past</div>}
            {closed.map((h) => (
              <HangoutCard
                key={h.id} h={h} plan={planOf(h.planId)} me={snap.me.id} people={snap.people} demo={demo}
                onVote={() => {}} onSend={() => {}} onOutcome={() => {}}
                onRecap={(n, p) => void store.addRecap(h.id, n, p)}
                onCopy={() => void store.copyPlan(h.planId)}
                onNudgeVote={() => {}}
              />
            ))}
          </>
        )}

        {tab === 'friends' && (
          <FriendsPanel
            me={snap.me} friends={snap.friends} people={snap.people}
            incoming={snap.incoming} outgoing={snap.outgoing} demo={demo}
            onRequest={(u) => store.sendFriendRequest(u)}
            onAccept={(id) => void store.acceptFriendRequest(id)}
            onDecline={(id) => void store.declineFriendRequest(id)}
            onRemove={(id) => void store.removeFriend(id)}
            onThreshold={(n) => void store.setThreshold(n)}
          />
        )}
      </main>

      <nav className="fixed bottom-0 inset-x-0 z-10 bg-bg/95 backdrop-blur border-t border-line">
        <div className="max-w-md mx-auto grid grid-cols-3">
          {(['feed', 'hangouts', 'friends'] as Tab[]).map((t) => {
            const badge = t === 'hangouts' ? open.length : t === 'friends' ? snap.incoming.length : 0
            return (
              <button key={t} onClick={() => setTab(t)} className={`py-3 text-sm font-bold ${tab === t ? 'text-brand' : 'text-mute'}`}>
                {t}{badge > 0 ? ` (${badge})` : ''}
              </button>
            )
          })}
        </div>
      </nav>

      {adding && <AddPlanSheet onClose={() => setAdding(false)} onCreate={(p) => store.createPlan(p)} />}
      {sharing && <ShareSheet plan={sharing.plan} url={sharing.url} onClose={() => setSharing(null)} />}
    </div>
  )
}
