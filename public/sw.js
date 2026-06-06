const APP_CACHE = "watson-web-ui-app-v4";
const API_CACHE = "watson-web-ui-api-v4";
const APP_SHELL = ["/", "/manifest.webmanifest", "/pwa/icon.svg"];
const CACHE_PREFIXES = ["watson-web-ui-", "watson-local-ui-"];
const PRECACHE_MANIFEST_URL = "/precache-manifest.json";

self.addEventListener("install", (event) => {
  event.waitUntil(precacheAppShell());
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => CACHE_PREFIXES.some((prefix) => key.startsWith(prefix)))
            .filter((key) => ![APP_CACHE, API_CACHE].includes(key))
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }

  if (event.data?.type === "CACHE_URLS" && Array.isArray(event.data.urls)) {
    event.waitUntil(cacheAppUrls(event.data.urls));
  }
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirst(request, API_CACHE, offlineJson()));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, APP_CACHE, caches.match("/")));
    return;
  }

  event.respondWith(cacheFirst(request, APP_CACHE));
});

async function networkFirst(request, cacheName, fallback) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }

    return fallback instanceof Promise ? fallback : fallback;
  }
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }

  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(cacheName);
    await cache.put(request, response.clone());
  }

  return response;
}

function offlineJson() {
  return new Response(JSON.stringify({ error: "Offline and no cached response is available." }), {
    status: 503,
    headers: { "Content-Type": "application/json" }
  });
}

async function cacheAppUrls(urls) {
  const cache = await caches.open(APP_CACHE);
  await cacheUrls(cache, [...APP_SHELL, ...normalizeSameOriginUrls(urls)], "reload");
}

async function precacheAppShell() {
  const cache = await caches.open(APP_CACHE);
  const urls = await getPrecacheUrls();

  await cacheUrls(cache, urls, "no-cache");
}

async function getPrecacheUrls() {
  try {
    const response = await fetch(PRECACHE_MANIFEST_URL, { cache: "no-cache" });
    if (!response.ok) {
      return APP_SHELL;
    }

    const manifest = await response.json();
    if (!Array.isArray(manifest.urls)) {
      return APP_SHELL;
    }

    return [...new Set([...APP_SHELL, ...normalizeSameOriginUrls(manifest.urls), PRECACHE_MANIFEST_URL])];
  } catch {
    return APP_SHELL;
  }
}

async function cacheUrls(cache, urls, cacheMode) {
  await Promise.allSettled(
    [...new Set(urls)].map(async (url) => {
      const response = await fetch(url, { cache: cacheMode });
      if (response.ok) {
        await cache.put(url, response);
      }
    })
  );
}

function normalizeSameOriginUrls(urls) {
  return urls
    .map((url) => {
      try {
        return new URL(url, self.location.origin);
      } catch {
        return null;
      }
    })
    .filter((url) => url && url.origin === self.location.origin)
    .map((url) => url.pathname + url.search);
}
