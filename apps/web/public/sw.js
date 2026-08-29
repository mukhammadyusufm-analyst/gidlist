/*
 * Service worker.
 *
 * IT CACHES EXACTLY ONE THING: the offline page. Nothing else is ever stored.
 *
 * That is not laziness, it is the whole design. A service worker cache has no
 * session attached to it, so anything user-scoped that goes in is served back
 * to whoever asks next — including a different person on a shared device. It is
 * the same rule that keeps `unstable_cache` in this codebase restricted to rows
 * whose SELECT policy is `to public using (true)`. A checklist, a submission or
 * a member list must never end up here.
 *
 * It exists for two reasons only:
 *
 *   1. Android requires a fetch handler before it will offer to install a site.
 *      Without this file there is no "Add to Home screen" prompt.
 *   2. A navigation that fails because the phone lost signal should say so,
 *      rather than showing the browser's dinosaur.
 *
 * Everything else goes straight to the network and is not touched.
 *
 * When real offline support is wanted — filling in a checklist in a basement
 * and syncing on the way out — that is a queue of pending writes in IndexedDB,
 * not a response cache, and it belongs with the Expo work rather than here.
 */

const CACHE = 'gidlist-shell-v1';
const OFFLINE_URL = '/offline';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add(new Request(OFFLINE_URL, { cache: 'reload' })))
      // Take over immediately. A worker waiting for every tab to close means an
      // offline fallback that only starts working tomorrow.
      .then(() => self.skipWaiting())
      .catch(() => {
        // A failed precache must not fail the install, or the worker never
        // activates and the install prompt never appears.
      }),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Only ever page navigations. Not API calls, not RSC payloads, not images —
  // those are where user data lives, and they are left entirely alone.
  if (request.method !== 'GET' || request.mode !== 'navigate') return;

  event.respondWith(
    fetch(request).catch(async () => {
      const cached = await caches.match(OFFLINE_URL);
      // If even the offline page is missing, let the browser show its own
      // error rather than returning something empty.
      return cached ?? Response.error();
    }),
  );
});
