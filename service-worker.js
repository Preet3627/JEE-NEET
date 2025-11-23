// This file is now configured for Workbox's injectManifest strategy.
import { precacheAndRoute } from 'workbox-precaching';

// This is the injection point that the Vite PWA plugin needs.
// It will be replaced with a list of assets to precache.
precacheAndRoute(self.__WB_MANIFEST);

// Listen for push notifications
self.addEventListener('push', (event) => {
    if (!event.data) {
        console.log("Push event but no data");
        return;
    }

    try {
        const data = event.data.json();
        const title = data.title || "JEE Scheduler Pro";
        
        // Ensure the data object contains the URL for deep linking
        const notificationData = data.data || { url: '/' };
        
        const options = {
            body: data.body,
            icon: 'https://ponsrischool.in/wp-content/uploads/2025/11/Gemini_Generated_Image_ujvnj5ujvnj5ujvn.png',
            badge: 'https://ponsrischool.in/wp-content/uploads/2025/11/Gemini_Generated_Image_ujvnj5ujvnj5ujvn.png',
            data: notificationData
        };
        event.waitUntil(self.registration.showNotification(title, options));
    } catch (e) {
        console.error("Error parsing push data:", e);
        // Fallback for plain text notifications
        const title = "JEE Scheduler Pro";
        const options = { body: event.data.text(), data: { url: '/' } };
        event.waitUntil(self.registration.showNotification(title, options));
    }
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    // Extract the URL from the notification data (default to root if not present)
    const urlToOpen = event.notification.data?.url || '/';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // Check if a window is already open
            for (const client of clientList) {
                // If exact match or root, focus and navigate
                if ('focus' in client) {
                    return client.focus().then(c => {
                        if ('navigate' in c) {
                            return c.navigate(urlToOpen);
                        }
                        return c;
                    });
                }
            }
            // If no window is open, open a new one
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});

// Activate the new service worker as soon as it's installed
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});