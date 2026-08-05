/* firebase-messaging-sw.js — REQUIRED by Firebase Cloud Messaging, and must
   live at the site root with this exact filename. This is what lets a
   notification actually appear even when SSSDP is fully closed — the piece
   sw.js (the older, general-purpose worker) explicitly said this app didn't
   have yet. This is that missing piece.

   It only handles BACKGROUND messages (app closed / tab not focused).
   Foreground messages (app open) are handled directly in index.html via
   firebase.messaging().onMessage(), so the same announcement doesn't show
   twice.
*/
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');
importScripts('firebase-config.js');

firebase.initializeApp(self.FIREBASE_CONFIG);
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = (payload.notification && payload.notification.title) || 'SSSDP';
  const body = (payload.notification && payload.notification.body) || '';
  const annId = payload.data && payload.data.annId;
  self.registration.showNotification(title, {
    body,
    icon: 'school-logo.jpg',
    tag: annId || undefined // same tag replaces instead of stacking duplicates
  });
});

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
