const CACHE="tattoo-dice-admin-panel-v24";
const FILES=["/admin/","/admin/index.html","/admin/live/","/admin/live/index.html","/admin/live/live-shell.css?v=1","/admin/admin-panel.css?v=3","/admin/admin-panel.js?v=2","/admin/admin-nav.js?v=1","/admin/manifest.webmanifest","/admin/assets/admin-ranking-header.png","/admin/assets/admin-icon-192.png","/admin/assets/admin-icon-512.png"];
self.addEventListener("install",event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)));self.skipWaiting();});
self.addEventListener("activate",event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))));self.clients.claim();});
self.addEventListener("fetch",event=>{if(event.request.method!=="GET")return;event.respondWith(fetch(event.request).then(response=>{const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));return response;}).catch(()=>caches.match(event.request)));});
