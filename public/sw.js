const CACHE_NAME = 'dodo-audio-v13';
const BASE = '/DodoAudio';
const AUDIO_PREFIX = BASE + '/api/audio/';

// IDB schema must match services/fileStore.ts
const IDB_NAME = 'dodo-audio-files';
const IDB_STORE = 'files';

const PRECACHE_URLS = [
  BASE + '/',
  BASE + '/index.html',
  BASE + '/manifest.json',
  BASE + '/favicon.ico',
  BASE + '/assets/icon.png',
  BASE + '/assets/favicon.png',
  BASE + '/lib/jsmediatags.min.js',
];

function openIdb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbGet(db, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

// Serve an audio file from IDB with full HTTP Range support so
// HTMLAudioElement on iOS Safari can actually seek inside the file.
async function serveAudio(id, request) {
  const db = await openIdb();
  const blob = await idbGet(db, id);
  if (!blob) return new Response('Not Found', { status: 404 });

  const size = blob.size;
  const type = blob.type || 'audio/mpeg';
  const range = request.headers.get('range');

  if (range) {
    const match = /bytes=(\d+)-(\d*)/.exec(range);
    if (match) {
      const start = parseInt(match[1], 10);
      const end = match[2] ? parseInt(match[2], 10) : size - 1;
      const chunk = blob.slice(start, end + 1);
      return new Response(chunk, {
        status: 206,
        headers: {
          'Content-Type': type,
          'Content-Range': `bytes ${start}-${end}/${size}`,
          'Content-Length': String(chunk.size),
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'no-store',
        },
      });
    }
  }
  return new Response(blob, {
    headers: {
      'Content-Type': type,
      'Content-Length': String(size),
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-store',
    },
  });
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(PRECACHE_URLS.map((url) => cache.add(url).catch(() => null)))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // Virtual audio endpoint backed by IDB — gives HTML <audio> proper Range support
  if (url.pathname.startsWith(AUDIO_PREFIX)) {
    const id = decodeURIComponent(url.pathname.slice(AUDIO_PREFIX.length));
    event.respondWith(serveAudio(id, event.request));
    return;
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match(BASE + '/index.html').then((cached) => cached || new Response('Offline', { status: 503 }))
      )
    );
    return;
  }

  if (url.pathname.startsWith(BASE + '/')) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        }).catch(() => cached);
      })
    );
    return;
  }
});
