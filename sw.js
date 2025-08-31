/* sw.js — MindGym PWA Service Worker
   - Offline app shell with safe precache (skips missing files)
   - Network-first for JS/JSON; cache-first for other assets
   - Offline fallback for navigations
   - Version-aware dynamic cache via version.json
   - Supports SKIP_WAITING message for instant upgrades
*/

const APP = 'mindgym';
const STATIC_REV = 'v1'; // bump if you change the SHELL list below
let DYNAMIC_REV = 'v1';  // updated from version.json at install

// ---- Core app shell (keep these accurate) ----
const SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './version.json'
];

// ---- Optional assets (safe: will be skipped if absent) ----
const ICONS = [
  './icons/icon-192.png',
  './icons/icon-512.png',
];

const SOUNDS = [
  './assets/sounds/level-up.mp3',
  './assets/sounds/click.mp3',
  './assets/sounds/success.mp3',
  './assets/sounds/error.mp3'
];

const THEMES = [
  './assets/themes/default.css',
  './assets/themes/quittr.css',
  './assets/themes/mint.css',
  './assets/themes/sunset.css',
  './assets/themes/oled.css'
];

const GAMES = [
  // If you split modules later, list them here; otherwise app.js already includes them.
  './assets/games/memory.js',
  './assets/games/iqtest.js',
  './assets/games/visualization.js',
  './assets/games/nback.js'
];

function staticCacheName() { return `${APP}-static-${STATIC_REV}`; }
function dynamicCacheName() { return `${APP}-dynamic-${DYNAMIC_REV}`; }

// Safely add many URLs (skips missing/404s instead of failing the whole install)
async function safeAddAll(cache, urls) {
  await Promise.all(urls.map(async (u) => {
    try {
      const res = await fetch(u, { cache: 'no-store' });
      if (res.ok) await cache.put(u, res.clone());
    } catch {
      // ignore missing or network errors during install
    }
  }));
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    // Try to read version.json to seed dynamic cache version
    try {
      const res = await fetch('./version.json', { cache: 'no-store' });
      if (res.ok) {
        const v = await res.json();
        if (v && (v.build || v.version)) {
          DYNAMIC_REV = `v${v.build || v.version}`;
        }
      }
    } catch {/* keep default */}

    const cache = await caches.open(staticCacheName());
    // Precache core shell first
    await safeAddAll(cache, SHELL);
    // Then optional assets (skips missing)
    await safeAddAll(cache, ICONS);
    await safeAddAll(cache, SOUNDS);
    await safeAddAll(cache, THEMES);
    await safeAddAll(cache, GAMES);

    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.map((k) => {
        const keep = (k === staticCacheName()) || (k === dynamicCacheName());
        if (!keep && k.startsWith(`${APP}-`)) return caches.delete(k);
      })
    );
    await self.clients.claim();
  })());
});

// ---- Strategies ----
async function networkFirst(req) {
  try {
    const fresh = await fetch(req);
    // put into dynamic cache
    const cache = await caches.open(dynamicCacheName());
    cache.put(req, fresh.clone());
    return fresh;
  } catch {
    const cached = await caches.match(req);
    if (cached) return cached;
    throw new Error('NetworkFirst failed and no cache');
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

function isNavigation(event) {
  const req = event.request;
  return req.mode === 'navigate' ||
         (req.method === 'GET' && req.headers.get('accept')?.includes('text/html'));
}

// ---- Fetch routing ----
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const sameOrigin = url.origin === self.location.origin;

  // App navigation: try network, fall back to cached index.html
  if (isNavigation(event)) {
    event.respondWith((async () => {
      try {
        return await fetch(event.request);
      } catch {
        return (await caches.match('./index.html')) ||
               new Response('Offline', { status: 503, headers:{'Content-Type':'text/plain'}});
      }
    })());
    return;
  }

  // JS/JSON: network-first (get fresh code/config)
  if (sameOrigin && /\.(?:js|json)$/.test(url.pathname)) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  // Everything else same-origin: cache-first
  if (sameOrigin) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  // Cross-origin: try network, fallback to cache if available
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

// ---- Messages ----
// From page: navigator.serviceWorker.controller.postMessage({type:'SKIP_WAITING'})
// Query version: navigator.serviceWorker.controller.postMessage({type:'GET_VERSION'}, [messageChannel.port2])
self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (data.type === 'GET_VERSION') {
    event.ports?.[0]?.postMessage({ static: STATIC_REV, dynamic: DYNAMIC_REV });
  }
});

// (Optional) periodic sync of version.json (if enabled by page)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'mindgym-version-sync') {
    event.waitUntil((async () => {
      try {
        const res = await fetch('./version.json', { cache: 'no-store' });
        if (res.ok) {
          const v = await res.json();
          const next = `v${v.build || v.version}`;
          if (next && next !== DYNAMIC_REV) {
            DYNAMIC_REV = next; // new dynamic cache name will apply to subsequent puts
          }
        }
      } catch {/* ignore */}
    })());
  }
});
