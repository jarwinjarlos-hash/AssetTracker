const CACHE_NAME = 'asset-tracker-cache-v1';
const urlsToCache = [
  '/',
  'My_Asset.html',
  'manifest.json',
  'styles/style.css',
  'scripts/app.js',
  'scripts/database.js',
  'scripts/ui.js',
  'scripts/features.js',
  'scripts/utils.js',
  'https://unpkg.com/dexie/dist/dexie.js',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  // Use a cache-first strategy
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        // If the request is for the root, try to serve My_Asset.html from cache
        if (new URL(event.request.url).pathname === '/') {
            return caches.match('My_Asset.html');
        }
        return fetch(event.request);
      })
    );
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});