// Service Worker for Should I Retake? - BRACU CGPA Calculator
// Provides offline functionality and caching

const CACHE_NAME = 'bracu-cgpa-calculator-v1.1';
const urlsToCache = [
  '/should-i-retake/',
  '/should-i-retake/index.html',
  '/should-i-retake/faq.html',
  '/should-i-retake/styles.css',
  '/should-i-retake/animations.css',
  '/should-i-retake/script.js',
  '/should-i-retake/manifest.json',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
];

// Install service worker and skip waiting
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        // Force the waiting service worker to become the active service worker
        return self.skipWaiting();
      })
  );
});

// Activate service worker and clean old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Take control of all pages immediately
      return self.clients.claim();
    })
  );
});

// Fetch event with network-first strategy for HTML/JS/CSS
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Network-first strategy for our own files to get latest updates
  if (url.origin === location.origin && 
      (url.pathname.endsWith('.html') || 
       url.pathname.endsWith('.js') || 
       url.pathname.endsWith('.css') ||
       url.pathname === '/should-i-retake/' ||
       url.pathname === '/should-i-retake/index.html')) {
    
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // If we get a valid response, cache it and return
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });
            return response;
          }
          // If network fails, try cache
          return caches.match(event.request);
        })
        .catch(() => {
          // Network failed, try cache
          return caches.match(event.request);
        })
    );
  } else {
    // Cache-first strategy for external resources
    event.respondWith(
      caches.match(event.request)
        .then((response) => {
          if (response) {
            return response;
          }
          
          return fetch(event.request).then((response) => {
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });
            
            return response;
          });
        })
    );
  }
});

// Handle background sync
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

function doBackgroundSync() {
  // Handle any background sync tasks
  console.log('Background sync triggered');
}
