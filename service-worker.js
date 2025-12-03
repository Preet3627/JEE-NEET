
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
        
        // The payload from backend/admin broadcast should include 'url' or 'action' in data
        // Example payload: { title: "...", body: "...", data: { url: "/?action=start_practice&id=123" } }
        const notificationData = data.data || { url: '/' };
        
        const options = {
            body: data.body,
            icon: 'https://ponsrischool.in/wp-content/uploads/2025/11/Gemini_Generated_Image_ujvnj5ujvnj5ujvn.png',
            badge: 'https://ponsrischool.in/wp-content/uploads/2025/11/Gemini_Generated_Image_ujvnj5ujvnj5ujvn.png',
            data: notificationData,
            actions: [
                { action: 'open', title: 'Open App' }
            ]
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
    
    // Extract the URL from the notification data. 
    // Support both direct URL or action construction
    let urlToOpen = event.notification.data?.url || '/';
    
    // Add domain if missing
    if (urlToOpen.startsWith('/')) {
        urlToOpen = self.location.origin + urlToOpen;
    }

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // Check if a window is already open
            for (const client of clientList) {
                // If exact match or root, focus and navigate
                if (client.url === urlToOpen && 'focus' in client) {
                    return client.focus();
                }
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