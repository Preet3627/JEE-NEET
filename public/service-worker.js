import { precacheAndRoute } from 'workbox-precaching';

// self.__WB_MANIFEST is the placeholder filled by workbox-webpack-plugin
// with a list of all precachable assets.
precacheAndRoute(self.__WB_MANIFEST || []);

// Enable navigation preload if the browser supports it
self.addEventListener('activate', (event) => {
  event.waitUntil(async () => {
    if (self.registration.navigationPreload) {
      await self.registration.navigationPreload.enable();
    }
  });
});

// Custom service worker logic for offline deep linking
self.addEventListener('fetch', (event) => {
  // Only handle navigation requests
  if (event.request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          // Try to get the preloaded response, or fetch from the network
          const preloadResponse = await event.preloadResponse;
          if (preloadResponse) {
            return preloadResponse;
          }
          const networkResponse = await fetch(event.request);
          return networkResponse;
        } catch (error) {
          // If network fails (e.g., offline), serve the cached index.html
          console.log('Fetch failed; serving cached content for navigation.', error);
          const cache = await caches.open('pwa-cache'); // Use your cache name
          return await cache.match('/index.html'); // Serve the main app shell
        }
      })(),
    );
  }

  // Handle custom protocol for deep linking
  // This part might need more context depending on how the custom protocol is invoked
  // For web+jeescheduler:// URLs, the browser itself might redirect to /?url=...
  // The service worker would then intercept the fetch for /index.html and potentially the URL parameter.
  // The logic above for 'navigate' should cover this.
});