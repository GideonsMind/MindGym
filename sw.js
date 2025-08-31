/* MindGym Service Worker
   - Offline app shell with version awareness (reads version.json)
   - Network-first for JS/JSON; cache-first for static assets
   - Offline fallback for navigations
*/

const APP = 'mindgym';
const STATIC_REV = 'v1'; // bump if you change static asset list
let DYNAMIC_REV = 'v1';  // will be updated from version.json after install

// Core shell assets to precache
const SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './version.json'
];

// Optional: add icons if you have them
const ICONS = [
  './icons/icon-192.png',
  './icons/icon-512.png'
];

const OFFLINE_FALLBACK_HTML = './index.html';

function staticCacheName() {
  return `${APP}-static-${STATIC_REV}`;
}
function dynamicCacheName() {
  return `${APP}-dynamic-${DYNAMIC_REV}`;
}

// Install: pre-cache shell, read version.json to seed dynamic cache version
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    // Fetch version.json to set DYNAMIC_REV
    try {
      const res = await fetch('./version.json', { cache: 'no-store' });
      if (res.ok) {
        const v = await res.json();
        if (v && (v.version || v.build)) {
          DYNAMIC_REV = `v${v.build || v.version}`;
        }
      }
    } catch (_) {
      // keep default DYNAMIC_REV
    }

    const cache = await caches.open(staticCacheName());
    await cache.addAll([...SHELL, ...ICONS]);
    self.skipWaiting();
  })());
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.map((k) => {
        const keep = (k === staticCacheName()) || (k === dynamicCacheName());
        if (!keep && k.startsWith(`${APP}-`)) {
          return caches.delete(k);
        }
      })
    );
    await self.clients.claim();
  })());
});

// Strategy helpers
async function networkFirst(req) {
  try {
    const fresh = await fetch(req);
    const cache = await caches.open(dynamicCacheName());
    cache.put(req, fresh.clone());
    return fresh;
  } catch {
    const cached = await caches.match(req);
    if (cached) return cached;
    throw new Error('NetworkFirst: no cache and network failed');
  }
}

async function cacheFirst(req) {
  const cached = await caches.match(req);
  if (cached) return cached;
  const fresh = await fetch(req);
  const cache = await caches.open(dynamicCacheName());
  cache.put(req, fresh.clone());
  return fresh;
}

function isNavigationRequest(e) {
  return e.request.mode === 'navigate' ||
         (e.request.method === 'GET' &&
          e.request.headers.get('accept')?.includes('text/html'));
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Ignore cross-origin fetches that aren't same-origin assets
  const sameOrigin = url.origin === self.location.origin;

  // App shell navigation: try network, fall back to cached index.html
  if (isNavigationRequest(event)) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(event.request);
        return fresh;
      } catch {
        const cachedShell = await caches.match(OFFLINE_FALLBACK_HTML);
        return cachedShell || new Response('Offline', { status: 503 });
      }
    })());
    return;
  }

  // For JS & JSON: network-first (to get latest code/config)
  if (sameOrigin && /\.(?:js|json)$/.test(url.pathname)) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  // Other same-origin assets (HTML/CSS/PNG/…): cache-first
  if (sameOrigin) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  // Cross-origin: try network, fall back to cache if we already have it
  event.respondWith((async () => {
    try {
      return await fetch(event.request);
    } catch {
      const cached = await caches.match(event.request);
      if (cached) return cached;
      throw new Error('Cross-origin fetch failed and no cache');
    }
  })());
});

// Listen for manual update messages from the page
// Use from page: navigator.serviceWorker.controller.postMessage({type:'SKIP_WAITING'})
self.addEventListener('message', (event) => {
  const { type } = event.data || {};
  if (type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (type === 'GET_VERSION') {
    event.ports?.[0]?.postMessage({ static: STATIC_REV, dynamic: DYNAMIC_REV });
  }
});

// Optional: background sync of version.json to rotate dynamic cache earlier
self.addEventListener('periodicsync', async (event) => {
  if (event.tag === 'mindgym-version-sync') {
    event.waitUntil((async () => {
      try {
        const res = await fetch('./version.json', { cache: 'no-store' });
        if (res.ok) {
          const v = await res.json();
          const next = `v${v.build || v.version}`;
          if (next && next !== DYNAMIC_REV) {
            DYNAMIC_REV = next;
            // touching dynamic cache name is enough; old dynamic caches will be purged on next activate
          }
        }
      } catch { /* ignore */ }
    })());
  }
});
