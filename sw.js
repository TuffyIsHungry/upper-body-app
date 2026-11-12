// Offline support. The app opens from the saved copy if the network is slow (gyms!),
// and quietly refreshes that copy in the background when the network answers.
const CACHE = "upper-body-v3";
const SHELL = ["./", "index.html", "manifest.webmanifest", "icon2-180.png", "icon2-192.png", "icon2-512.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL))); self.skipWaiting(); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))); self.clients.claim(); });
const save = (req, r) => { if (r && r.ok) { const cp = r.clone(); caches.open(CACHE).then(c => c.put(req, cp)); } return r; };
self.addEventListener("fetch", e => {
  const req = e.request; if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (req.mode === "navigate" || url.origin === location.origin) {
    e.respondWith(new Promise(resolve => {
      let done = false; const fin = r => { if (!done && r) { done = true; resolve(r); } };
      const fallback = async () => (await caches.match(req)) || (req.mode === "navigate" ? await caches.match("index.html") : undefined);
      fetch(req).then(r => fin(save(req, r))).catch(async () => { const h = await fallback(); if (h) fin(h); else if (!done) { done = true; resolve(Response.error()); } });
      setTimeout(async () => fin(await fallback()), 2500);
    }));
  } else if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => save(req, r))));
  }
});
