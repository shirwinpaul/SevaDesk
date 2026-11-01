// SevaDesk service worker — offline app shell.
// - Pages: network first, fall back to the cached copy (so the app opens in the field).
// - Build assets (/_next/static): cache first (they are content-hashed).
// - /api/* (AI) is NEVER cached or intercepted: AI simply shows "needs internet".
// - Only the app's code is cached. User data lives encrypted in IndexedDB, never here.
const VERSION = "sevadesk-v1";
const SHELL = ["/", "/home", "/notes", "/cases", "/tasks", "/events", "/volunteers", "/camps", "/reports", "/media", "/donations", "/resources", "/settings", "/more", "/manifest.webmanifest", "/icon.svg", "/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => Promise.allSettled(SHELL.map((url) => cache.add(url))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (url.pathname.startsWith("/_next/static/") || /\.(png|svg|woff2?|ico)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(VERSION).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  if (req.mode === "navigate" || req.headers.get("accept")?.includes("text/html") || url.searchParams.has("_rsc")) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(async () => (await caches.match(req)) || (await caches.match(url.pathname)) || (await caches.match("/home")) || Response.error()),
    );
  }
});
