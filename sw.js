// Bump this whenever urlsToCache changes so returning users actually pick
// up the new app shell instead of serving a stale cached copy forever.
const CACHE_NAME = 'life-tracker-v17';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './js/data-model.js',
  './js/idb.js',
  './js/storage.js',
  './js/drive-sync.js',
  './js/compare.js',
  './js/splitwise.js'
];

// Install Service Worker and cache files
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

// Drop any caches from a previous version so old app-shell files (including
// ones that no longer exist, like a stale js/ bundle) don't linger forever.
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

// Serve cached content when offline
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Return cached version or fetch from network
        return response || fetch(event.request);
      })
  );
});