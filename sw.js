self.addEventListener('install', e=>{
  e.waitUntil(caches.open('mg-core-v1').then(c=>c.addAll(['./','./index.html','./styles.css','./app.js','./manifest.webmanifest','./version.json'])));
  self.skipWaiting();
});
self.addEventListener('activate', e=>{ self.clients.claim(); });
self.addEventListener('fetch', e=>{
  e.respondWith(caches.match(e.request).then(r=> r || fetch(e.request)));
});