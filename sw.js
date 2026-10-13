// Bump this whenever urlsToCache changes so returning users actually pick
// up the new app shell instead of serving a stale cached copy forever.
const CACHE_NAME = 'life-tracker-v85';
const urlsToCache = [
  './',
  './index.html',
  './privacy.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './js/firebase-config.js',
  './js/firebase-service.js',
  './js/config.js',
  './js/ui-dialogs.js',
  './js/data-model.js',
  './js/idb.js',
  './js/storage.js',
  './js/drive-sync.js',
  './js/compare.js',
  './js/share-image.js',
  './js/splitwise.js',
  './js/groups.js',
  './js/pdf-report-data.js',
  './js/pdf-report.js',
  './js/pdf-writer.js',
  './js/pdf-download.js',
  './js/loans.js',
  './js/timezone-data.js',
  './js/world-clock.js',
  './js/reminders.js',
  './js/vault/crypto.js',
  './js/vault/vaultStore.js',
  './js/vault/vaultService.js',
  './js/vault/vaultSync.js',
  './js/vault/patternLock.js',
  './js/vault/vaultUI.js',
  './js/games/puzzle-samples.js',
  './js/games/catalogue.js',
  './js/games/sliding-puzzle.js',
  './js/games/bomb-defusal.js',
  './js/games/memory-match.js',
  './js/games/sudoku.js',
  './js/games/ludo-service.js',
  './js/games/ludo.js',
  './js/games/neon-grid.js'
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

// Listen for message to skip waiting
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Drop any caches from a previous version so old app-shell files don't linger forever.
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

// Serve network content when online, fallback to cache when offline
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (!url.protocol.startsWith('http')) return;

  // For HTML navigation requests (e.g. index.html) - Network First, Cache Fallback
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => caches.match(event.request).then(cached => cached || caches.match('./index.html')))
    );
    return;
  }

  // For JS, CSS, and other assets: Try network first, fallback to cache
  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response && response.status === 200) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// Notification click handler: focuses open tab and notifies it to open the reminder
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const reminderId = event.notification.data ? event.notification.data.reminderId : null;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          client.focus();
          if (reminderId) {
            client.postMessage({ type: 'OPEN_REMINDER', reminderId });
          }
          return;
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('./');
      }
    })
  );
});