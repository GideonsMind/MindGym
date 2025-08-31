self.addEventListener('install', e=>{
  self.skipWaiting();
  e.waitUntil(caches.open('mg-v1').then(c=>c.addAll([
    './','./index.html','./styles.css','./app.js','./manifest.webmanifest','./version.json'
  ])));
});
self.addEventListener('activate', e=>{ self.clients.claim(); });
self.addEventListener('fetch', e=>{
  const url = new URL(e.request.url);
  if(url.origin===location.origin){
    e.respondWith(caches.match(e.request).then(r=> r || fetch(e.request)));
  }
});
