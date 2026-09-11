const CACHE_NAME = 'bryt-cbt-v1';

// Core assets to pre-cache immediately
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/login/index.html',
  '/dashboard/index.html',
  '/exams/index.html',
  '/static/main.css',
  '/static/app.js',
  '/static/img/brytcbtsim-logo.png',
  '/static/img/brytcbtsim-logo1.png',
  '/offline.html'
];

// Install: pre-cache critical app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate: clean up older cache versions
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch strategy
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. Bypass Service Worker cache for Auth, Database (Supabase), and Payments (Paystack)
  if (
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('paystack.co') ||
    url.hostname.includes('aloc.com.ng') ||
    event.request.method !== 'GET'
  ) {
    return; // Pass straight to network
  }

  // 2. Network-First with Offline Fallback for HTML page navigation
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Clone and update cache with the fresh page
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(async () => {
          const cachedResponse = await caches.match(event.request);
          if (cachedResponse) return cachedResponse;
          return caches.match('/offline.html');
        })
    );
    return;
  }

  // 3. Stale-While-Revalidate for CSS, JS, Fonts, and Images
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});