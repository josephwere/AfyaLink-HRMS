const CACHE_VERSION = "v2";
let buildId = CACHE_VERSION;
try {
  const swUrl = new URL(self.location.href);
  // Optional: allow build-specific cache versions via `/sw.js?build=<id>`.
  buildId = swUrl.searchParams.get("build") || CACHE_VERSION;
} catch {
  // Ignore URL parsing issues in older browsers.
}

const STATIC_CACHE = `afyalink-static-${buildId}`;
const RUNTIME_CACHE = `afyalink-runtime-${buildId}`;
const APP_SHELL = ["/", "/index.html", "/manifest.json", "/favicon.ico"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      try {
        await cache.addAll(APP_SHELL);
      } catch {
        // If install happens while offline, keep SW install resilient.
      }
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith("afyalink-") && ![STATIC_CACHE, RUNTIME_CACHE].includes(k))
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("message", (event) => {
  if (!event.data) return;
  if (event.data.type === "SKIP_WAITING") self.skipWaiting();
});

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

async function putIfOk(cacheName, req, res) {
  if (!res || !res.ok) return;
  const cache = await caches.open(cacheName);
  await cache.put(req, res.clone());
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Workaround: Chrome can issue `only-if-cached` requests for cross-origin.
  if (req.cache === "only-if-cached" && req.mode !== "same-origin") return;

  if (req.method !== "GET") return;
  if (!isSameOrigin(url)) return;

  // Let API writes continue to app/offline queue logic.
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(req).catch(() =>
        new Response(JSON.stringify({ message: "Offline" }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        })
      )
    );
    return;
  }

  // Hashed JS/CSS chunks: network-first to avoid stale/missing chunk white screens across deploys.
  if (
    url.pathname.startsWith("/assets/") &&
    (req.destination === "script" || req.destination === "style")
  ) {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req);
          await putIfOk(RUNTIME_CACHE, req, res);
          return res;
        } catch {
          return (await caches.match(req)) || Response.error();
        }
      })()
    );
    return;
  }

  // Other static assets: cache-first (but never cache failed responses).
  if (req.destination === "font" || req.destination === "image" || req.destination === "style") {
    event.respondWith(
      (async () => {
        const cached = await caches.match(req);
        if (cached) return cached;
        const res = await fetch(req);
        await putIfOk(RUNTIME_CACHE, req, res);
        return res;
      })()
    );
    return;
  }

  // Navigations: bypass HTTP cache so `index.html` stays in sync with deployed chunks.
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(new Request(req, { cache: "no-store" }));
          if (res && res.ok) {
            // Cache the latest shell for offline fallback.
            const cache = await caches.open(STATIC_CACHE);
            await cache.put("/index.html", res.clone());
          }
          return res;
        } catch {
          return (await caches.match("/index.html")) || Response.error();
        }
      })()
    );
    return;
  }

  // Default: network-first with cache fallback; cache only successes.
  event.respondWith(
    (async () => {
      try {
        const res = await fetch(req);
        await putIfOk(RUNTIME_CACHE, req, res);
        return res;
      } catch {
        return (await caches.match(req)) || (await caches.match("/index.html")) || Response.error();
      }
    })()
  );
});
