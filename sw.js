const CORE='mindgym-final-core-v1';
self.addEventListener('install',e=>{
  self.skipWaiting();
  e.waitUntil(caches.open(CORE).then(c=>c.addAll(['./','./index.html','./styles.css','./app.js','./version.json','./manifest.webmanifest'])));
});
self.addEventListener('activate',e=>{
  e.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k!==CORE).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch',e=>{
  const url=new URL(e.request.url);
  if(url.pathname.endsWith('/version.json')||url.pathname.endsWith('/app.js')){
    e.respondWith(fetch(e.request).then(res=>{const clone=res.clone(); caches.open(CORE).then(c=>c.put(e.request,clone)); return res;}).catch(()=>caches.match(e.request)));
    return;
  }
  e.respondWith(caches.match(e.request).then(hit=>hit||fetch(e.request)));
});
