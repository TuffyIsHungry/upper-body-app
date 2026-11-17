// Opens instantly from the saved copy, then checks GitHub for a newer version in the background.
// When one has arrived, the page shows "New version ready" with a Reload button.
const CACHE = "upper-body-v4";
const SHELL = ["./", "index.html", "manifest.webmanifest", "icon2-180.png", "icon2-192.png", "icon2-512.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: "no-cache" }))))); self.skipWaiting(); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
const PAGE = "index.html";
// fetch the newest page, store it, and tell open windows if it differs from what they are running
async function refresh(clientId) {
  try {
    const r = await fetch(PAGE, { cache: "no-cache" }); if (!r.ok) return;
    const c = await caches.open(CACHE), old = await c.match(PAGE), txt = await r.clone().text();
    const same = old && (await old.text()) === txt;
    await c.put(PAGE, r.clone()); await c.put("./", r);
    if (!same && old) for (const w of await self.clients.matchAll({ type: "window" })) w.postMessage({ type: "update-ready" });
  } catch (e) { /* offline: keep the saved copy */ }
}
self.addEventListener("fetch", e => {
  const req = e.request; if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (req.mode === "navigate") {
    // the app page: saved copy right away; network only if there is no saved copy yet
    e.respondWith((async () => {
      const hit = (await caches.match(PAGE)) || (await caches.match("./"));
      if (hit) { e.waitUntil(refresh()); return hit; }
      try { const r = await fetch(req); if (r.ok) { const c = await caches.open(CACHE); c.put(PAGE, r.clone()); } return r; } catch (err) { return Response.error(); }
    })());
  } else if (url.origin === location.origin) {
    // icons, manifest: saved copy first, refreshed quietly
    e.respondWith(caches.match(req).then(hit => {
      const net = fetch(req).then(r => { if (r.ok) { const cp = r.clone(); caches.open(CACHE).then(c => c.put(req, cp)); } return r; }).catch(() => hit);
      if (hit) { e.waitUntil(net); return hit; } return net;
    }));
  } else if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => { if (r.ok || r.type === "opaque") { const cp = r.clone(); caches.open(CACHE).then(c => c.put(req, cp)); } return r; })));
  }
});
