/* ==============================================================
   SSSDP — Firebase configuration (Fixed)

   NOTE: uses `self.FIREBASE_CONFIG` rather than `window.FIREBASE_CONFIG` —
   `self` works both on a normal page (where self === window) AND inside a
   service worker (where `window` doesn't exist at all). This file is loaded
   by firebase-messaging-sw.js as well as the normal pages, so it has to work
   in both places.

   vapidKey — REQUIRED for push notifications, and the one thing you need to
   fill in yourself: Firebase Console → Project Settings → Cloud Messaging →
   "Web Push certificates" → Generate key pair → paste the key below.
============================================================== */

self.FIREBASE_CONFIG = {
  apiKey: "AIzaSyB_cpdhs5409pafS7CUbfDKRGdB9gu55GI",
  authDomain: "sheno-secondary-school.firebaseapp.com",
  projectId: "sheno-secondary-school",
  storageBucket: "sheno-secondary-school.firebasestorage.app",
  messagingSenderId: "585306537782",
  appId: "1:585306537782:web:815edc3647a826deb67d97",
  measurementId: "G-TVPTZT2WTJ",
  vapidKey: "BDMfZES16EeaiFTz8-TRV8nCpfu_cme-c_H5vVqHZHOo4JeNS4e0yU6c_LiAn_Xv6bW2vSlJ7auEZQZJOEVEjgE"
};
