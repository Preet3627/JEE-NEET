import { precacheAndRoute } from 'workbox-precaching';

// self.__WB_MANIFEST is the placeholder filled by workbox-webpack-plugin
// with a list of all precachable assets.
precacheAndRoute(self.__WB_MANIFEST || []);

// Any custom service worker logic goes here.
// For example, caching strategies for runtime requests.
// self.addEventListener('fetch', (event) => {
//   if (event.request.mode === 'navigate') {
//     event.respondWith(caches.match('/')); 
//   }
// });