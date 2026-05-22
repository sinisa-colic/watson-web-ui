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
