import { useState } from 'react'
import { inviteUrl } from '../lib/invite'

/**
 * Getting two people connected is the whole precondition for this app doing
 * anything, so it is the first thing on the Friends tab rather than a setting
 * buried somewhere.
 */
export function InviteCard({ username, friendCount }: { username: string; friendCount: number }) {
  const [copied, setCopied] = useState(false)
  const url = inviteUrl(username)
  const text = `come be down with me on i'm down\n${url}`

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  const share = async () => {
    if (!navigator.share) return copy()
    try {
      await navigator.share({ text })
    } catch {
      /* they closed the sheet */
    }
  }

  return (
    <div className="bg-card border border-line rounded-2xl p-4 space-y-3">
      <div>
        <div className="font-extrabold">Invite a friend</div>
        <p className="text-mute text-xs mt-1">
          {friendCount === 0
            ? 'Nothing here works until someone else is in. Send this to one person.'
            : 'They open the link and the request is waiting for you to accept.'}
        </p>
      </div>
      <div className="bg-card2 border border-line rounded-xl px-3 py-2 text-xs text-mute break-all">{url}</div>
      <div className="flex gap-2">
        <button onClick={share} className="tap flex-1 bg-brand text-black font-bold rounded-xl py-2.5">Send invite</button>
        <button onClick={copy} className="tap flex-1 bg-card2 border border-line rounded-xl py-2.5 font-bold text-sm">
          {copied ? 'copied' : 'Copy link'}
        </button>
      </div>
    </div>
  )
}
