/**
 * Registers the offline shell, in production only.
 *
 * Not in development, because a service worker caching a dev server is a very
 * effective way to spend an hour wondering why an edit did nothing.
 */
export function registerOffline() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // No offline support is a smaller problem than a failed boot.
    })
  })
}
