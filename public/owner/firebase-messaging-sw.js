importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyB7c8o7-wWM5D8F82AbM7V8tkTerBicZAc",
  authDomain: "visitor-app-push.firebaseapp.com",
  projectId: "visitor-app-push",
  storageBucket: "visitor-app-push.firebasestorage.app",
  messagingSenderId: "625801351744",
  appId: "1:625801351744:web:2733c5d5b0b2f6f94f45a5"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || 'Visitor Alert';
  const options = {
    body: payload.notification?.body || 'You have a new visitor',
    data: payload.data
  };
  self.registration.showNotification(title, options);
});
