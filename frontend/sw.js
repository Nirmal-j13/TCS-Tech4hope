// sw.js - Service Worker for PWA Employee Management App\
const CACHE_NAME = 'employee-pwa-cache-v1';
const urlsToCache = [
    '/',
    'frontend/index.html',
    'frontend/style.css',
    'frontend/app.js',
    'frontend/manifest.json',
    'https://cdn.tailwindcss.com', // Cache Tailwind CSS CDN
    'https://cdn.jsdelivr.net/npm/pouchdb@8.0.1/dist/pouchdb.min.js', // Cache PouchDB library
    'https://placehold.co/192x192/000000/FFFFFF?text=EMP', // Cache icon
    'https://placehold.co/512x512/000000/FFFFFF?text=EMP', // Cache icon
    'https://placehold.co/32x32/000000/FFFFFF?text=EMP' // Cache favicon
];

// --- Install Event ---
// This event is fired when the service worker is installed.
// It's a good place to cache the application shell.
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Installing...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[Service Worker] Caching app shell');
                return cache.addAll(urlsToCache);
            })
            .catch((error) => {
                console.error('[Service Worker] Failed to cache during install:', error);
            })
    );
});

// --- Activate Event ---
// This event is fired when the service worker is activated.
// It's a good place to clean up old caches.
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activating...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[Service Worker] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    // Ensure the service worker takes control of the page immediately
    self.clients.claim();
});

// --- Fetch Event ---
// This event is fired when the browser requests a resource.
// We can intercept the request and serve from cache or network.
self.addEventListener('fetch', (event) => {
    // We only want to handle HTTP(S) requests, not chrome-extension:// or other protocols
    if (event.request.url.startsWith('http')) {
        event.respondWith(
            caches.match(event.request)
                .then((response) => {
                    // Cache hit - return response
                    if (response) {
                        console.log('[Service Worker] Serving from cache:', event.request.url);
                        return response;
                    }
                    // No cache hit - fetch from network
                    console.log('[Service Worker] Fetching from network:', event.request.url);
                    return fetch(event.request)
                        .then((networkResponse) => {
                            // Check if we received a valid response
                            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                                return networkResponse;
                            }
                            // IMPORTANT: Clone the response. A response is a stream
                            // and can only be consumed once. We must clone it so that
                            // both the browser and the cache can consume it.
                            const responseToCache = networkResponse.clone();
                            caches.open(CACHE_NAME)
                                .then((cache) => {
                                    cache.put(event.request, responseToCache);
                                });
                            return networkResponse;
                        })
                        .catch((error) => {
                            console.error('[Service Worker] Fetch failed:', event.request.url, error);
                            // Provide a fallback for offline if a page cannot be fetched
                            // You could return an offline page here
                            // For this simple app, we'll just return a new Response indicating offline
                            return new Response('<h1>You are offline!</h1>', {
                                headers: { 'Content-Type': 'text/html' }
                            });
                        });
                })
        );
    }
});
