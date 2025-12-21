const CACHE_NAME = "ella-big-trip-v1";
const CACHE_VERSION = 'v2'; // bump this when you want to force-update
const ASSETS = [
  "/Financial_Travel_App/",
  "/Financial_Travel_App/index.html",
  "/Financial_Travel_App/styles.css",
  "/Financial_Travel_App/data.js",
  "/Financial_Travel_App/db.js",
  "/Financial_Travel_App/fx.js",
  "/Financial_Travel_App/app.js",
  "/Financial_Travel_App/manifest.json",
  "/Financial_Travel_App/icons/icon-192.png",
  "/Financial_Travel_App/icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});


self.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ type: 'window' });
      for (const client of clients) {
        client.postMessage({ type: 'SW_UPDATED' });
      }
    })()
  );
});


self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
