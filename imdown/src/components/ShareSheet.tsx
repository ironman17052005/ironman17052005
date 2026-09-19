import { useState } from 'react'
import type { Plan } from '../types'
import { money } from '../data/logic'

interface Props {
  plan: Plan
  url: string
  onClose: () => void
}

/**
 * Sharing has to work where the group already talks. This produces a link plus
 * a block of text worth pasting, and friends can say they are in from the link
 * without making an account.
 */
export function ShareSheet({ plan, url, onClose }: Props) {
  const [copied, setCopied] = useState<string | null>(null)

  const text = [
    plan.title,
    ...plan.steps.map((s, i) => `${i + 1}. ${s}`),
    `${money(plan.costPerPerson)} · ~${plan.hours}h · ${plan.bestTime}`,
    `down? ${url}`,
  ].join('\n')

  const copy = async (value: string, what: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(what)
    } catch {
      setCopied('could not copy, select it by hand')
    }
  }

  const native = async () => {
    if (!navigator.share) return copy(text, 'text')
    try {
      await navigator.share({ title: plan.title, text })
    } catch {
      /* the person closed the share sheet */
    }
  }

  return (
    <div className="fixed inset-0 z-20 bg-black/70 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="w-full max-w-md bg-card border border-line rounded-t-3xl sm:rounded-3xl p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black">Send to a group chat</h2>
          <button onClick={onClose} className="text-mute">close</button>
        </div>
        <p className="text-xs text-mute">They can tap "I'm down" from the link with just a first name. No account, no download.</p>

        <pre className="bg-card2 border border-line rounded-xl p-3 text-xs whitespace-pre-wrap break-words max-h-48 overflow-y-auto">{text}</pre>

        <div className="flex gap-2">
          <button onClick={native} className="tap flex-1 bg-brand text-black font-bold rounded-xl py-3">Share</button>
          <button onClick={() => copy(text, 'text')} className="tap flex-1 bg-card2 border border-line rounded-xl py-3 font-bold">Copy text</button>
        </div>
        <button onClick={() => copy(url, 'link')} className="tap w-full text-xs text-mute underline">copy just the link</button>
        {copied && <div className="text-xs text-ok text-center">{copied === 'link' || copied === 'text' ? `${copied} copied` : copied}</div>}
      </div>
    </div>
  )
}
