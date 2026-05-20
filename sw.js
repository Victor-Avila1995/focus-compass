// Focus Compass — minimal service worker.
// Caches the UI shell so the app is installable and opens fast.
// Never caches Apps Script API calls — task data always goes to the live network.

const CACHE_VERSION = 'focus-compass-v1';
const SHELL_FILES = [
  './',
  'index.html',
  'manifest.webmanifest',
  'icon.svg',
  'icon-192.png',
  'icon-512.png',
  'apple-touch-icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(SHELL_FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // Bypass cache entirely for the Apps Script backend and any non-GET requests
  if (url.hostname.endsWith('script.google.com') || req.method !== 'GET') {
    return; // let it hit the network normally
  }

  // Same-origin shell: network-first, fall back to cache when offline
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(req)
        .then(res => {
          // Update cache opportunistically
          const copy = res.clone();
          caches.open(CACHE_VERSION).then(c => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then(hit => hit || caches.match('index.html')))
    );
    return;
  }

  // Third-party (e.g. Google Fonts): cache-first, network fallback
  event.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE_VERSION).then(c => c.put(req, copy)).catch(() => {});
      return res;
    }).catch(() => hit))
  );
});
