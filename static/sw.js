const API_CACHE_NAME = 'sports-fetcher-api-v1';
const STATIC_CACHE_NAME = 'sports-fetcher-static-v1';
// Precaching is removed — assets are hash-based and served immutable.
// Runtime caching stays for offline resilience.

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((n) => n !== API_CACHE_NAME && n !== STATIC_CACHE_NAME)
          .map((n) => caches.delete(n))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== location.origin) return;

  if (url.pathname.startsWith('/api/')) {
    // Stale-while-revalidate for API
    event.respondWith(
      caches.open(API_CACHE_NAME).then((cache) =>
        cache.match(event.request).then((cached) => {
          const network = fetch(event.request)
            .then((resp) => {
              if (resp.ok) cache.put(event.request, resp.clone());
              return resp;
            })
            .catch(() => cached);
          return cached || network;
        })
      )
    );
    return;
  }

  // Immutable static assets: cache-first
  if (url.pathname.startsWith('/static/')) {
    event.respondWith(
      caches.open(STATIC_CACHE_NAME).then((cache) =>
        cache.match(event.request).then((cached) => {
          if (cached) return cached;
          return fetch(event.request).then((resp) => {
            if (resp.ok) cache.put(event.request, resp.clone());
            return resp;
          });
        })
      )
    );
    return;
  }
});