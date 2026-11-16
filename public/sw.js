/* PakDossier service worker — offline shell, network-first for /api.
 *
 * Hand-written (no workbox) so there is nothing to configure and nothing to
 * break at build time. Strategy per request kind is deliberate:
 *   /api/*        network-first  -> a stale dossier beats an empty one
 *   navigations   network-first  -> fall back to the cached shell when offline
 *   other assets  cache-first    -> hashed filenames are immutable
 */
const VERSION = 'pd-v1';
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(VERSION);
      // one bad URL must not fail the whole install
      await Promise.allSettled(SHELL.map((u) => cache.add(new Request(u, { cache: 'reload' }))));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

const isApi = (url) => url.pathname.startsWith('/api/');

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (isApi(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(VERSION);
        try {
          const fresh = await fetch(req);
          if (fresh.ok) await cache.put(req, fresh.clone());
          return fresh;
        } catch {
          const hit = await cache.match(req);
          if (hit) return hit;
          return new Response(JSON.stringify({ ok: false, code: 'offline', message: 'offline' }), {
            status: 503,
            headers: { 'content-type': 'application/json' },
          });
        }
      })(),
    );
    return;
  }

  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const cache = await caches.open(VERSION);
        try {
          const fresh = await fetch(req);
          await cache.put('/', fresh.clone());
          return fresh;
        } catch {
          return (await cache.match('/')) ?? (await cache.match('/index.html')) ?? Response.error();
        }
      })(),
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(VERSION);
      const hit = await cache.match(req);
      if (hit) return hit;
      try {
        const fresh = await fetch(req);
        if (fresh.ok) await cache.put(req, fresh.clone());
        return fresh;
      } catch {
        return Response.error();
      }
    })(),
  );
});
