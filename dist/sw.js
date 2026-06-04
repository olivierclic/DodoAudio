const CACHE_NAME = 'dodo-audio-v1';

// Files to cache on install (app shell)
const PRECACHE_URLS = [
  '/DodoAudio/',
  '/DodoAudio/index.html',
  '/DodoAudio/manifest.json',
  '/DodoAudio/favicon.ico',
  '/DodoAudio/assets/icon.png',
  '/DodoAudio/assets/favicon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // For navigation requests: serve index.html from cache (SPA fallback)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      caches.match('/DodoAudio/index.html').then((cached) => cached || fetch(event.request))
    );
    return;
  }

  // Cache-first for static assets (JS, CSS, images, fonts)
  if (
    url.pathname.startsWith('/_expo/') ||
    url.pathname.startsWith('/assets/') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.ico') ||
    url.pathname.endsWith('.woff2')
  ) {
    event.respondWith(
      caches.match(event.request).then(
        (cached) =>
          cached ||
          fetch(event.request).then((response) => {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
            return response;
          })
      )
    );
    return;
  }

  // Network-first for everything else
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
