import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { pendingInvite } from '../lib/invite'

/** Magic-link sign in for live mode. Username is set from the email prefix by a DB trigger. */
export function Auth() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  // Someone who arrived from an invite should know why they are being asked to
  // sign in, and that the request will be waiting when they come back.
  const invite = pendingInvite()

  const send = async () => {
    if (!supabase) return
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } })
    if (error) setErr(error.message)
    else setSent(true)
  }

  return (
    <div className="min-h-full flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-card border border-line rounded-2xl p-6 space-y-4">
        <div className="text-2xl font-black">i'm down</div>
        {invite ? (
          <p className="text-sm">
            <span className="font-bold">@{invite}</span>
            <span className="text-mute"> invited you. Sign in and the request goes to them.</span>
          </p>
        ) : (
          <p className="text-mute text-sm">Plans your friends actually did. Tap one, and when enough of you are down, it becomes real.</p>
        )}
        {sent ? (
          <p className="text-ok">Check your email for the sign-in link.</p>
        ) : (
          <>
            <input
              className="w-full bg-card2 border border-line rounded-xl px-4 py-3 outline-none focus:border-brand"
              placeholder="you@school.edu"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button onClick={send} className="tap w-full bg-brand text-black font-bold rounded-xl py-3">Send me a link</button>
            {err && <p className="text-brand text-sm">{err}</p>}
          </>
        )}
      </div>
    </div>
  )
}
