/*
 * biblio's service worker.
 *
 * Two jobs, and it is deliberately small enough to read in one sitting.
 *
 * 1. Offline. A local-first journal that cannot open on a plane or in a
 *    basement is a broken promise, and nobody reports it as a bug — they
 *    quietly stop trusting it. Entries already live in IndexedDB; this makes
 *    the app around them reachable too.
 *
 * 2. Updates you control. It never activates itself underneath someone. The
 *    page is told a new version is waiting and decides when — because a reload
 *    landing mid-sentence would be the app taking words away.
 */
const VERSION = "v1";
const SHELL = `biblio-shell-${VERSION}`;
const ASSETS = `biblio-assets-${VERSION}`;
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL).then((cache) => cache.addAll([OFFLINE_URL, "/icon.svg"])).catch(() => {}),
  );
  // No skipWaiting here on purpose: waiting is what gives the reader the say.
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => !k.endsWith(VERSION)).map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

/** The page asking to be updated now. */
self.addEventListener("message", (event) => {
  if (event.data === "skip-waiting") self.skipWaiting();
});

const isAsset = (url) =>
  url.pathname.startsWith("/_next/static/") ||
  url.pathname.endsWith(".svg") ||
  url.pathname.endsWith(".woff2") ||
  url.pathname.endsWith(".png");

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache anything that talks to a model, a store, or an account —
  // a stale answer here would be worse than no answer.
  if (url.pathname.startsWith("/api/")) return;

  // Build output is content-hashed, so a cache hit is always correct.
  if (isAsset(url)) {
    event.respondWith(
      caches.open(ASSETS).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        const res = await fetch(request);
        if (res.ok) cache.put(request, res.clone());
        return res;
      }),
    );
    return;
  }

  // Pages: network first so a fresh deploy is picked up immediately, with the
  // last good copy — then the offline page — behind it.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(request);
          const cache = await caches.open(SHELL);
          cache.put(request, res.clone());
          return res;
        } catch {
          const cache = await caches.open(SHELL);
          return (await cache.match(request)) || (await cache.match(OFFLINE_URL)) || Response.error();
        }
      })(),
    );
  }
});
