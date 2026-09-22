import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from './data/useStore'
import { buildFeed, doneHistory, emptyFilters, friendTaps, isFiltered, openHangoutFor, surprise, type FeedContext, type Filters } from './data/logic'
import { DemoStore } from './data/demoStore'
import { Auth } from './components/Auth'
import { PlanCard } from './components/PlanCard'
import { HangoutCard } from './components/HangoutCard'
import { FriendsPanel } from './components/FriendsPanel'
import { AddPlanSheet, type SheetMode } from './components/AddPlanSheet'
import { ShareSheet } from './components/ShareSheet'
import { SharePage } from './components/SharePage'
import { FilterBar } from './components/FilterBar'
import { clearInviteFromUrl, forgetInvite, pendingInvite, readInviteFromUrl, rememberInvite } from './lib/invite'
import { supabase } from './lib/supabase'
import type { Plan, PlanInput } from './types'

type Tab = 'feed' | 'hangouts' | 'friends'

/** A share link is the one route that must work signed out, so it is checked first. */
const sharedId = new URLSearchParams(window.location.search).get('s')

// An invite has to survive magic-link sign-in, which means leaving for an inbox
// and coming back on a fresh page load, so it is stashed before anything renders.
const invited = readInviteFromUrl()
if (invited) {
  rememberInvite(invited)
  clearInviteFromUrl()
}

export default function App() {
  if (sharedId) return <SharePage shareId={sharedId} />
  return <Main />
}

function Skeleton() {
  return (
    <div className="space-y-3" aria-hidden>
      {[0, 1, 2].map((i) => (
        <div key={i} className="bg-card border border-line rounded-2xl p-4 space-y-3 animate-pulse">
          <div className="h-5 w-2/3 bg-card2 rounded" />
          <div className="h-3 w-1/3 bg-card2 rounded" />
          <div className="h-3 w-full bg-card2 rounded" />
          <div className="h-3 w-5/6 bg-card2 rounded" />
          <div className="h-9 w-full bg-card2 rounded-xl" />
        </div>
      ))}
    </div>
  )
}

function Empty({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="bg-card border border-line rounded-2xl p-6 text-center space-y-2">
      <div className="font-extrabold">{title}</div>
      <p className="text-mute text-sm">{body}</p>
      {action}
    </div>
  )
}

function Main() {
  const { mode, store, snap, needsAuth, error, clearError } = useStore()
  const [tab, setTab] = useState<Tab>('feed')
  const [sheet, setSheet] = useState<SheetMode | null>(null)
  const [filters, setFilters] = useState<Filters>(emptyFilters)
  const [sharing, setSharing] = useState<{ plan: Plan; url: string } | null>(null)
  const [picked, setPicked] = useState<string | null>(null)
  const [inviteNote, setInviteNote] = useState<string | null>(null)
  const pickedRef = useRef<HTMLDivElement>(null)

  const ctx = useMemo<FeedContext | null>(() => {
    if (!snap) return null
    return { meId: snap.me.id, friends: snap.friends, taps: snap.taps, doneAt: doneHistory(snap), saved: snap.saved }
  }, [snap])

  const feed = useMemo(() => (snap && ctx ? buildFeed(snap.plans, filters, ctx) : []), [snap, ctx, filters])

  // Scroll a surprise pick into view instead of leaving the person hunting for it.
  useEffect(() => {
    if (picked) pickedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [picked])

  // Someone opened an invite link. Send the request once there is a session to
  // send it with, then forget it so a refresh does not send it again.
  useEffect(() => {
    const username = pendingInvite()
    if (!username || !store || !snap) return
    forgetInvite()
    void store
      .sendFriendRequest(username)
      .then((problem) => setInviteNote(problem ?? `Friend request sent to @${username}.`))
      .catch(() => setInviteNote(`Could not send the request to @${username}.`))
  }, [store, snap])

  if (needsAuth) return <Auth />
  if (!snap || !store || !ctx) {
    return (
      <div className="max-w-md mx-auto p-4 space-y-3">
        {error ? <div className="text-brand text-sm">{error}</div> : <Skeleton />}
      </div>
    )
  }

  const demo = mode === 'demo'
  const open = snap.hangouts.filter((h) => h.status === 'voting' || h.status === 'confirmed')
  const closed = snap.hangouts.filter((h) => h.status === 'done' || h.status === 'flopped')
  const vibes = Array.from(new Set(snap.plans.flatMap((p) => p.vibe))).sort()
  const planOf = (id: string) => snap.plans.find((p) => p.id === id)

  // Deleting is the only irreversible thing in the app, so it asks first.
  const removePlan = async (plan: Plan) => {
    if (!window.confirm(`Delete "${plan.title}"? This cannot be undone.`)) return
    const problem = await store.deletePlan(plan.id)
    if (problem) window.alert(problem)
  }

  const submitSheet = async (input: PlanInput) => {
    if (sheet?.kind === 'edit') await store.updatePlan(sheet.plan.id, input)
    else await store.createPlan(input)
  }

  const share = async (plan: Plan) => {
    const id = await store.createShare(plan.id)
    setSharing({ plan, url: `${window.location.origin}${window.location.pathname}?s=${id}` })
  }

  const rollDice = () => {
    const pick = surprise(snap.plans, ctx)
    if (!pick) return
    setFilters(emptyFilters)
    setTab('feed')
    setPicked(pick.id)
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
          <button onClick={() => setSheet({ kind: 'new' })} className="tap bg-card2 border border-line rounded-xl px-3 py-1.5 text-sm font-bold">+ plan</button>
        </div>
      </header>

      {error && (
        <div role="alert" className="mx-4 mt-3 flex items-start gap-2 text-xs bg-brand/10 border border-brand rounded-xl px-3 py-2">
          <span className="flex-1 text-brand">{error}</span>
          <button onClick={clearError} className="text-brand font-bold">dismiss</button>
        </div>
      )}

      {inviteNote && (
        <div className="mx-4 mt-3 flex items-start gap-2 text-xs bg-ok/10 border border-ok rounded-xl px-3 py-2">
          <span className="flex-1 text-ok">{inviteNote}</span>
          <button onClick={() => setInviteNote(null)} className="text-ok font-bold">ok</button>
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
            <FilterBar
              filters={filters}
              vibes={vibes}
              resultCount={feed.length}
              savedCount={snap.saved.length}
              onChange={(f) => { setFilters(f); setPicked(null) }}
              onReset={() => { setFilters(emptyFilters); setPicked(null) }}
              onSurprise={rollDice}
            />

            {snap.friends.length === 0 && (
              <div className="flex items-center justify-between gap-3 text-xs bg-card border border-line rounded-xl px-3 py-2">
                <span className="text-mute">Being down only does something once a friend is here.</span>
                <button onClick={() => setTab('friends')} className="tap text-brand font-bold shrink-0">invite</button>
              </div>
            )}

            {picked && (
              <div className="flex items-center justify-between text-xs bg-brand2/10 border border-brand2 rounded-xl px-3 py-2">
                <span className="text-brand2 font-bold">tonight, do this one</span>
                <button onClick={rollDice} className="tap text-brand2 underline">roll again</button>
              </div>
            )}

            {feed.length === 0 && (
              <Empty
                title={isFiltered(filters) ? 'Nothing matches' : 'No plans yet'}
                body={
                  isFiltered(filters)
                    ? 'Try fewer filters, or post the outing you are thinking of.'
                    : 'Post something you actually did and it becomes the first card.'
                }
                action={
                  <button
                    onClick={() => (isFiltered(filters) ? setFilters(emptyFilters) : setSheet({ kind: 'new' }))}
                    className="tap bg-brand text-black font-bold rounded-xl px-4 py-2 text-sm"
                  >
                    {isFiltered(filters) ? 'Clear filters' : 'Post a plan'}
                  </button>
                }
              />
            )}

            {feed.map((p) => {
              const hangout = openHangoutFor(snap, p.id, [snap.me.id, ...snap.friends])
              const joinable = hangout && !hangout.members.includes(snap.me.id) ? hangout.id : null
              const shareIds = snap.shares.filter((s) => s.planId === p.id && s.by === snap.me.id).map((s) => s.id)
              const isPick = picked === p.id
              return (
                <div key={p.id} ref={isPick ? pickedRef : undefined}>
                  <PlanCard
                    plan={p}
                    me={snap.me}
                    people={snap.people}
                    friendTappers={friendTaps(snap.taps, p.id, snap.friends)}
                    iTapped={snap.taps.some((t) => t.planId === p.id && t.userId === snap.me.id)}
                    saved={snap.saved.includes(p.id)}
                    joinable={joinable}
                    guestCount={snap.guestInterests.filter((g) => shareIds.includes(g.shareId)).length}
                    demo={demo}
                    highlight={isPick}
                    onTap={() => void store.tap(p.id)}
                    onUntap={() => void store.untap(p.id)}
                    onJoin={() => joinable && void store.joinHangout(joinable)}
                    onShare={() => void share(p)}
                    onCopy={() => setSheet({ kind: 'copy', from: p })}
                    onSave={() => void store.toggleSaved(p.id)}
                    onNudge={() => (store as unknown as DemoStore).nudge(p.id)}
                    onEdit={() => setSheet({ kind: 'edit', plan: p })}
                    onDelete={() => void removePlan(p)}
                  />
                </div>
              )
            })}
          </>
        )}

        {tab === 'hangouts' && (
          <>
            {open.length === 0 && closed.length === 0 && (
              <Empty
                title="Nothing proposed yet"
                body={`When ${snap.me.threshold} of you are down for the same plan, it lands here with times to vote on.`}
                action={<button onClick={() => setTab('feed')} className="tap bg-brand text-black font-bold rounded-xl px-4 py-2 text-sm">Browse plans</button>}
              />
            )}
            {open.map((h) => (
              <HangoutCard
                key={h.id} h={h} plan={planOf(h.planId)} me={snap.me.id} people={snap.people} demo={demo}
                onVote={(s) => void store.voteTime(h.id, s)}
                onSend={(t) => void store.sendMessage(h.id, t)}
                onOutcome={(ok) => void store.markOutcome(h.id, ok)}
                onRecap={(n, p) => void store.addRecap(h.id, n, p)}
                onCopy={() => { const src = planOf(h.planId); if (src) setSheet({ kind: 'copy', from: src }) }}
                onNudgeVote={(s) => (store as unknown as DemoStore).nudgeVote(h.id, s)}
              />
            ))}

            {closed.length > 0 && <div className="text-xs text-mute pt-2">Past</div>}
            {closed.map((h) => (
              <HangoutCard
                key={h.id} h={h} plan={planOf(h.planId)} me={snap.me.id} people={snap.people} demo={demo}
                onVote={() => {}} onSend={() => {}} onOutcome={() => {}}
                onRecap={(n, p) => void store.addRecap(h.id, n, p)}
                onCopy={() => { const src = planOf(h.planId); if (src) setSheet({ kind: 'copy', from: src }) }}
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
              <button
                key={t}
                onClick={() => setTab(t)}
                aria-current={tab === t ? 'page' : undefined}
                className={`py-3 text-sm font-bold ${tab === t ? 'text-brand' : 'text-mute'}`}
              >
                {t}{badge > 0 ? ` (${badge})` : ''}
              </button>
            )
          })}
        </div>
      </nav>

      {sheet && (
        <AddPlanSheet
          mode={sheet}
          existingTitles={snap.plans.map((p) => p.title)}
          onClose={() => setSheet(null)}
          onSubmit={submitSheet}
        />
      )}
      {sharing && <ShareSheet plan={sharing.plan} url={sharing.url} onClose={() => setSharing(null)} />}
    </div>
  )
}
