const KEY = 'imdown.pendingInvite'
const PARAM = 'add'

/**
 * Invite links.
 *
 * Adding a friend by username assumes you already know it. In live mode a
 * username is derived from an email prefix, so nobody can guess a friend's, and
 * the app is useless until two people are connected. A link solves it: you send
 * one, they open it, and the request is waiting.
 *
 * The catch is magic-link sign-in. Opening an invite while signed out means
 * leaving for an inbox and coming back on a fresh page load, so the invite has
 * to be remembered across that round trip rather than living in the URL.
 */
export function readInviteFromUrl(): string | null {
  const raw = new URLSearchParams(window.location.search).get(PARAM)
  if (!raw) return null
  const username = raw.trim().toLowerCase().replace(/^@/, '')
  return /^[a-z0-9_]{2,20}$/.test(username) ? username : null
}

/** Takes it out of the URL so a refresh does not send the request twice. */
export function clearInviteFromUrl() {
  const url = new URL(window.location.href)
  if (!url.searchParams.has(PARAM)) return
  url.searchParams.delete(PARAM)
  window.history.replaceState(null, '', url.pathname + url.search + url.hash)
}

export function rememberInvite(username: string) {
  try {
    localStorage.setItem(KEY, username)
  } catch {
    // Private mode. The invite is lost, which is recoverable; crashing is not.
  }
}

export function pendingInvite(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function forgetInvite() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* nothing to do */
  }
}

/** The link to hand someone. */
export function inviteUrl(username: string): string {
  return `${window.location.origin}${window.location.pathname}?${PARAM}=${encodeURIComponent(username)}`
}
