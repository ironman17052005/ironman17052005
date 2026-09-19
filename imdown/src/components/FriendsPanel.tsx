import { useState } from 'react'
import type { Id, Profile } from '../types'

interface Props {
  me: Profile
  friends: Id[]
  people: Record<Id, Profile>
  onAdd: (username: string) => Promise<string | null>
  mode: 'demo' | 'live'
}

export function FriendsPanel({ me, friends, people, onAdd, mode }: Props) {
  const [u, setU] = useState('')
  const [msg, setMsg] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const err = await onAdd(u)
    setMsg(err ?? 'Added.')
    if (!err) setU('')
  }

  const link = `${window.location.origin}/?add=${me.username}`

  return (
    <div className="space-y-4">
      <div className="bg-card border border-line rounded-2xl p-4 space-y-2">
        <div className="text-xs text-mute">You</div>
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-full bg-brand text-black grid place-items-center text-xl">{me.emoji}</span>
          <div>
            <div className="font-extrabold">{me.displayName}</div>
            <div className="text-mute text-sm">@{me.username}</div>
          </div>
        </div>
        <button onClick={() => navigator.clipboard?.writeText(link)} className="tap text-xs text-mute underline">copy invite link</button>
      </div>

      <form onSubmit={submit} className="flex gap-2">
        <input value={u} onChange={(e) => setU(e.target.value)} placeholder="add by @username" className="flex-1 bg-card2 border border-line rounded-xl px-3 py-2 outline-none focus:border-brand" />
        <button className="tap bg-brand text-black font-bold rounded-xl px-4">add</button>
      </form>
      {msg && <div className="text-xs text-mute">{msg}</div>}
      {mode === 'demo' && <div className="text-xs text-mute">Demo friends: minh, jess, dre, tina, omar. They tap and vote on their own.</div>}

      <div className="space-y-2">
        {friends.map((id) => (
          <div key={id} className="flex items-center gap-3 bg-card border border-line rounded-2xl px-4 py-3">
            <span className="w-9 h-9 rounded-full bg-card2 grid place-items-center text-lg">{people[id]?.emoji ?? '🙂'}</span>
            <div>
              <div className="font-bold">{people[id]?.displayName ?? id}</div>
              <div className="text-mute text-xs">@{people[id]?.username}</div>
            </div>
          </div>
        ))}
        {friends.length === 0 && <div className="text-mute text-sm">No friends yet. The app is dead without them. Add three.</div>}
      </div>
    </div>
  )
}
