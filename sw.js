/**
 * OneNote Spatial Canvas — Offline Airplane Mode Service Worker (sw.js)
 * Enables 100% offline note-taking and drawing with zero network connection.
 */

const CACHE_NAME = 'onenote-canvas-v1.5.3';
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './components.css',
  './manifest.json',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './src/canvas.js',
  './src/table_module.js',
  './src/image_module.js',
  './src/math_module.js',
  './src/markdown_module.js',
  './src/element_flow.js',
  './src/note_box.js',
  './src/keyboard_shortcuts.js',
  './src/history_manager.js',
  './src/storage_vault.js',
  './src/ribbon_controller.js',
  './src/ink_engine.js',
  './src/sidebar.js',
  './src/app.js'
];

// Install: Cache all essential app shell files
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate: Clean up old versions of cache immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Fresh-First (Network-First) strategy:
// Always fetches the freshest files while connected.
// Automatically falls back to offline cached copies when network is unavailable (Airplane Mode).
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // If fetch succeeds, update the cache copy in the background
        if (
          networkResponse &&
          networkResponse.status === 200 &&
          (event.request.url.startsWith('http') || event.request.url.startsWith('https'))
        ) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Offline / Airplane Mode fallback: retrieve from cache
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // If HTML page request fails offline, return index.html
          if (event.request.headers.get('accept')?.includes('text/html')) {
            return caches.match('./index.html') || caches.match('./');
          }
        });
      })
  );
});
