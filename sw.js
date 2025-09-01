// Offline cache (v4) – simple and safe
const CACHE_NAME = 'mg-cache-v4';
const CORE_ASSETS = [
  '/', '/index.html?v=4', '/styles.css?v=4', '/app.js?v=4',
  '/manifest.webmanifest?v=4'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(CORE_ASSETS)));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.origin === location.origin) {
    e.respondWith(caches.match(e.request).then(res => res || fetch(e.request)));
  }
});