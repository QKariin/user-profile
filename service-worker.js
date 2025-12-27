// Name your cache
const CACHE_NAME = "ecosystem-pwa-v1";

// Files you want cached for offline use
// Keep this minimal since your main content is an iframe to qkarin.com
const OFFLINE_ASSETS = [
  "/",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png"
];

// Install event
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(OFFLINE_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate event
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch event
self.addEventListener("fetch", event => {
  const req = event.request;

  // Don't try to cache cross-origin iframe content (qkarin.com)
  if (!req.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    caches.match(req).then(cached => {
      return (
        cached ||
        fetch(req).catch(() => {
          // Offline fallback for root only
          if (req.mode === "navigate") {
            return caches.match("/");
          }
        })
      );
    })
  );
});