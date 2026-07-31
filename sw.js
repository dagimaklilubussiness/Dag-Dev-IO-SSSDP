/* SSSDP service worker — intentionally minimal.
   Its only job is to let the page display real OS-level notifications
   (registration.showNotification) for new announcements, and to focus/open
   the app when a notification is tapped. It does NOT do offline caching.

   IMPORTANT LIMITATION: this app has no push server (e.g. Firebase Cloud
   Messaging) behind it — it only talks to Firestore directly from the
   browser. That means a new announcement can only trigger a notification
   while this service worker is alive, which in practice means: the SSSDP
   tab/PWA is open, or was open recently enough that the browser kept the
   worker running in the background. It CANNOT wake up a fully closed app
   the way SMS or a real push notification can. Real "notify even when the
   app is completely closed" requires adding a push backend (FCM + a small
   server or Cloud Function) — a bigger project than a static Firestore app.
*/
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('./index.html');
    })
  );
});
