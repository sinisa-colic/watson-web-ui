export function registerServiceWorker() {
  if (!window.isSecureContext) {
    console.warn("Service worker offline support requires HTTPS, or localhost during local development.");
    return;
  }

  if (!("serviceWorker" in navigator)) {
    console.warn("Service workers are not available in this browser context.");
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then(async (registration) => {
        await navigator.serviceWorker.ready;
        cacheLoadedAppShell(registration);
      })
      .catch((error: unknown) => {
        console.warn("Service worker registration failed", error);
      });
  });
}

export async function forcePwaUpdate() {
  if ("serviceWorker" in navigator) {
    const registration = await navigator.serviceWorker.getRegistration();
    await registration?.update();
    registration?.waiting?.postMessage({ type: "SKIP_WAITING" });
  }

  if ("caches" in window) {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key.startsWith("watson-web-ui-") || key.startsWith("watson-local-ui-"))
        .map((key) => caches.delete(key))
    );
  }

  await fetch("/", { cache: "reload" }).catch(() => undefined);
  window.location.reload();
}

function cacheLoadedAppShell(registration: ServiceWorkerRegistration) {
  const worker = registration.active ?? registration.waiting ?? registration.installing;
  if (!worker) {
    return;
  }

  worker.postMessage({
    type: "CACHE_URLS",
    urls: getLoadedSameOriginUrls()
  });
}

function getLoadedSameOriginUrls() {
  const urls = new Set<string>(["/", "/manifest.webmanifest", "/pwa/icon.svg"]);

  for (const element of document.querySelectorAll<HTMLLinkElement | HTMLScriptElement>("link[href], script[src]")) {
    const value = "href" in element ? element.href : element.src;
    if (value) {
      urls.add(value);
    }
  }

  for (const entry of performance.getEntriesByType("resource")) {
    if (entry.name.startsWith(window.location.origin)) {
      urls.add(entry.name);
    }
  }

  return [...urls];
}
