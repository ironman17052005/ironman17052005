import { useState } from 'react'
import type { FriendRequest, Id, Profile } from '../types'
import { MIN_THRESHOLD } from '../types'

interface Props {
  me: Profile
  friends: Id[]
  people: Record<Id, Profile>
  incoming: FriendRequest[]
  outgoing: FriendRequest[]
  demo: boolean
  onRequest: (username: string) => Promise<string | null>
  onAccept: (id: Id) => void
  onDecline: (id: Id) => void
  onRemove: (id: Id) => void
  onThreshold: (n: number) => void
}

export function FriendsPanel({ me, friends, people, incoming, outgoing, demo, onRequest, onAccept, onDecline, onRemove, onThreshold }: Props) {
  const [u, setU] = useState('')
  const [msg, setMsg] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const err = await onRequest(u)
    setMsg(err ?? 'Request sent. They have to accept before you see each other.')
    if (!err) setU('')
  }

  return (
    <div className="space-y-4">
      <div className="bg-card border border-line rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-full bg-brand text-black grid place-items-center text-xl">{me.emoji}</span>
          <div>
            <div className="font-extrabold">{me.displayName}</div>
            <div className="text-mute text-sm">@{me.username}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm border-t border-line pt-3">
          <span className="text-mute">Propose a time when</span>
          {[2, 3, 4].map((n) => (
            <button key={n} onClick={() => onThreshold(n)} className={`tap rounded-lg px-3 py-1 border ${me.threshold === n ? 'border-brand text-brand' : 'border-line text-mute'}`}>{n}</button>
          ))}
          <span className="text-mute">are down</span>
        </div>
        <div className="text-[11px] text-mute">Minimum is {MIN_THRESHOLD}. Two people is a plan.</div>
      </div>

      {incoming.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs text-mute">Wants to be friends</div>
          {incoming.map((r) => (
            <div key={r.id} className="flex items-center gap-3 bg-card border border-line rounded-2xl px-4 py-3">
              <span className="w-9 h-9 rounded-full bg-card2 grid place-items-center text-lg">{people[r.from]?.emoji ?? '🙂'}</span>
              <div className="min-w-0 flex-1">
                <div className="font-bold truncate">{people[r.from]?.displayName ?? r.from}</div>
                <div className="text-mute text-xs">@{people[r.from]?.username}</div>
              </div>
              <button onClick={() => onAccept(r.id)} className="tap bg-brand text-black font-bold rounded-xl px-3 py-1.5 text-sm">accept</button>
              <button onClick={() => onDecline(r.id)} className="tap text-mute text-sm">no</button>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={submit} className="flex gap-2">
        <input value={u} onChange={(e) => setU(e.target.value)} placeholder="add by @username" className="flex-1 bg-card2 border border-line rounded-xl px-3 py-2 outline-none focus:border-brand" />
        <button className="tap bg-brand text-black font-bold rounded-xl px-4">ask</button>
      </form>
      {msg && <div className="text-xs text-mute">{msg}</div>}
      {demo && <div className="text-xs text-mute">Demo users: minh, jess, dre, tina, omar. They accept, or they don't.</div>}

      {outgoing.length > 0 && (
        <div className="text-xs text-mute">
          Waiting on {outgoing.map((r) => people[r.to]?.displayName ?? '@' + r.to).join(', ')}
        </div>
      )}

      <div className="space-y-2">
        {friends.map((id) => (
          <div key={id} className="flex items-center gap-3 bg-card border border-line rounded-2xl px-4 py-3">
            <span className="w-9 h-9 rounded-full bg-card2 grid place-items-center text-lg">{people[id]?.emoji ?? '🙂'}</span>
            <div className="min-w-0 flex-1">
              <div className="font-bold truncate">{people[id]?.displayName ?? id}</div>
              <div className="text-mute text-xs">@{people[id]?.username}</div>
            </div>
            <button onClick={() => onRemove(id)} className="tap text-mute text-xs">remove</button>
          </div>
        ))}
        {friends.length === 0 && <div className="text-mute text-sm">No friends yet. The feed is dead without them. Ask two.</div>}
      </div>
    </div>
  )
}
