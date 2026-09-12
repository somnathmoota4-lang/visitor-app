importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyAgdLSNm6vG-ZQ2P9B7WtZuiJYvywj6L_Y",
  authDomain: "visitor-app-push-47fd8.firebaseapp.com",
  projectId: "visitor-app-push-47fd8",
  storageBucket: "visitor-app-push-47fd8.firebasestorage.app",
  messagingSenderId: "452927501608",
  appId: "1:452927501608:web:d9ad76cb143bcea7ed0c1d"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || 'Guard Alert';
  const options = {
    body: payload.notification?.body || 'Owner responded',
    data: payload.data
  };
  self.registration.showNotification(title, options);
});
