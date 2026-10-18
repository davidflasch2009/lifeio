/* ==========================================================================
   Lifeio Service Worker
   WICHTIG: CACHE bei JEDEM Deploy hochzählen (lifeio-v2, lifeio-v3, …),
   sonst zeigt das iPhone ggf. noch alte Assets.
   ========================================================================== */
const CACHE = 'lifeio-v9';

const APP_SHELL = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png', './sprout.png',
  './icon-maskable-512.png', './apple-touch-icon.png', './favicon-64.png'];
const CDN_ASSETS = [
  'https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore-compat.js'
];
const CDN_HOSTS = ['www.gstatic.com'];
// Firestore-, Auth- und Google-API-Requests NIE cachen
const BYPASS = /(firestore\.googleapis\.com|googleapis\.com|identitytoolkit|securetoken|firebaseinstallations|accounts\.google\.com|apis\.google\.com|\/__\/auth\/)/;

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(APP_SHELL);
    // CDN-Libs einzeln vorcachen – ein Fehler soll die Installation nicht abbrechen
    await Promise.all(CDN_ASSETS.map(url =>
      cache.add(new Request(url, { mode: 'cors' })).catch(err => console.warn('[SW] nicht vorgecacht:', url, err))
    ));
  })());
  // Kein automatisches skipWaiting: die App zeigt „Neue Version – Neu laden“ an.
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('lifeio-') && k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (BYPASS.test(url.href)) return;

  // Navigation (HTML): network-first, Fallback auf Cache
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res.ok) {
          const cache = await caches.open(CACHE);
          cache.put('./index.html', res.clone());
        }
        return res;
      } catch (err) {
        return (await caches.match(req, { ignoreSearch: true }))
          || (await caches.match('./index.html'))
          || (await caches.match('./'))
          || Response.error();
      }
    })());
    return;
  }

  // Statische Assets (eigene + Firebase-SDK): cache-first
  if (url.origin === self.location.origin || CDN_HOSTS.includes(url.hostname)) {
    event.respondWith((async () => {
      const cached = await caches.match(req, { ignoreVary: true });
      if (cached) return cached;
      const res = await fetch(req);
      if (res.ok && (res.type === 'basic' || res.type === 'cors')) {
        const cache = await caches.open(CACHE);
        cache.put(req, res.clone());
      }
      return res;
    })());
  }
});
