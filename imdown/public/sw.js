/*
 * Offline shell.
 *
 * This gets used on a phone, on campus wifi, in a car park, in a basement bar.
 * Without this the app is a white screen the moment the signal drops, which is
 * exactly when someone is trying to check where everyone is meeting.
 *
 * Two rules, deliberately conservative:
 *   - /assets/ is content-hashed by the build, so a hit there can never be
 *     stale. Cache first, and it opens instantly.
 *   - Everything else on this origin is network first with a cached fallback,
 *     so a new deploy is picked up the moment there is signal, and a dead
 *     connection still shows the last page instead of nothing.
 *
 * Cross-origin requests are left alone entirely. Supabase calls must never be
 * served from a cache: a stale plan or a stale vote is worse than an error.
 */

const VERSION = 'imdown-v1'
const SHELL = '/index.html'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll([SHELL, '/manifest.webmanifest', '/icon-192.png']))
      // A failed precache must not wedge the install; the fetch handler copes.
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return // never touch Supabase

  // Content-hashed build output: a cache hit is always correct.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ??
          fetch(request).then((res) => {
            if (res.ok) {
              const copy = res.clone()
              void caches.open(VERSION).then((c) => c.put(request, copy))
            }
            return res
          }),
      ),
    )
    return
  }

  // A navigation, including a share link, falls back to the cached shell so the
  // app still boots with no connection.
  event.respondWith(
    fetch(request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone()
          void caches.open(VERSION).then((c) => c.put(request, copy))
        }
        return res
      })
      .catch(async () => {
        const hit = await caches.match(request)
        if (hit) return hit
        if (request.mode === 'navigate') {
          const shell = await caches.match(SHELL)
          if (shell) return shell
        }
        return new Response('offline', { status: 503, statusText: 'offline' })
      }),
  )
})
