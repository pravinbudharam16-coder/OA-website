const cacheName = "smartoa-ui-v20-organized-project";
const assets = [
  "./login.html",
  "./02_Frontend/assets/css/login.css",
  "./02_Frontend/assets/js/login.js",
  "./index.html",
  "./02_Frontend/assets/css/styles.css",
  "./02_Frontend/assets/js/app.js",
  "./03_Hardware/README.md",
  "./manifest.webmanifest",
  "./02_Frontend/assets/images/icon.svg",
  "./02_Frontend/assets/images/icon-192.png",
  "./02_Frontend/assets/images/icon-512.png",
  "./02_Frontend/assets/images/smartoa-logo.png",
  "./02_Frontend/assets/images/oa-risk-marker.svg",
  "./privacy.html",
  "./terms.html",
  "./02_Frontend/assets/css/legal.css",
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(cacheName).then(cache => cache.addAll(assets)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== cacheName).map(key => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request).then(response => {
      const copy = response.clone();
      if (response.ok && event.request.url.startsWith(self.location.origin)) {
        caches.open(cacheName).then(cache => cache.put(event.request, copy)).catch(() => {});
      }
      return response;
    }).catch(() => caches.match(event.request).then(cached => cached || caches.match("./login.html")))
  );
});
