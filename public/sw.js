const CACHE_NAME = "hr-rajaklana-shell-v1";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type !== "CACHE_ROUTES") return;
  const routes = Array.isArray(event.data.routes)
    ? event.data.routes.filter(
        (route) => route === "/" || route === "/schedule"
      )
    : [];
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(
        routes.map(async (route) => {
          const request = new Request(route, { credentials: "include" });
          const response = await fetch(request);
          if (response.ok) await cache.put(request, response);
        })
      )
    )
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/")
  ) {
    return;
  }

  const cacheableAsset =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname === "/manifest.webmanifest";
  const cacheablePage =
    request.mode === "navigate" &&
    !["/login", "/change-password"].includes(url.pathname);

  if (!cacheableAsset && !cacheablePage) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        return (
          cached ||
          new Response("Halaman ini belum tersimpan untuk akses offline.", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          })
        );
      })
  );
});
