// Deckhand offline helper. The app page is fetched fresh whenever you're online (so updates arrive right
// away) and the saved copy is used when you're offline. The text reader's files are kept after first use.
// Card data, prices, sync and EDHREC always go straight to the network.
const CACHE = "deckhand-v5";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icons/icon-192-v2.png", "./icons/icon-512-v2.png", "./icons/maskable-512-v2.png", "./icons/apple-touch-icon-v2.png", "./images/welcome-800.jpg", "./images/welcome-1600.jpg"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
// Saved copies are shared by every site on junkcase.github.io, so only Deckhand's own old copies ("deckhand-…") are cleared
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("deckhand-") && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
const saved = req => caches.open(CACHE).then(c => c.match(req));
self.addEventListener("fetch", e => {
  const req = e.request; if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.searchParams.has("update-check")) return;              // "is there a newer version?": straight to the network, never saved
  if (url.origin === location.origin) {                         // the app itself: network first, saved copy when offline
    e.respondWith(fetch(req).then(r => { if (r.ok) { const c = r.clone(); caches.open(CACHE).then(ca => ca.put(req, c)); } return r; })
      .catch(() => saved(req).then(r => r || (req.mode === "navigate" ? saved("./index.html") : Response.error()))));
    return;
  }
  if (url.hostname === "cdn.jsdelivr.net" && /tesseract/.test(url.pathname)) {      // text reader files: keep after first use
    e.respondWith(saved(req).then(hit => hit || fetch(req).then(r => { if (r.ok) { const c = r.clone(); caches.open(CACHE).then(ca => ca.put(req, c)); } return r; })));
  }
});
