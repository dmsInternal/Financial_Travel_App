const CACHE_VERSION = "v2"; // bump this each release
const CACHE_NAME = `ella-big-trip-${CACHE_VERSION}`;

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
  self.skipWaiting(); // allow immediate activation
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    // cleanup old caches
    const keys = await caches.keys();
    await Promise.all(keys.map(k => (k !== CACHE_NAME ? caches.delete(k) : Promise.resolve())));

    // take control of open pages
    await self.clients.claim();
  })());
});

// Allow the page to tell SW "activate now"
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
