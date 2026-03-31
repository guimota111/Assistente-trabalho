/* ──────────── Firebase ──────────── */
const firebaseConfig = {
    apiKey: "AIzaSyBWsWY3OJOZvy-2YVSWqDK_38dRi7eXAqA",
    authDomain: "laudos-a7009.firebaseapp.com",
    projectId: "laudos-a7009",
    storageBucket: "laudos-a7009.firebasestorage.app",
    messagingSenderId: "225605061167",
    appId: "1:225605061167:web:f25c92f63b2617392114da"
};
firebase.initializeApp(firebaseConfig);
const db  = firebase.firestore();
const auth = firebase.auth();

// Cache dados offline automaticamente
db.enablePersistence({ synchronizeTabs: true })
  .catch(err => console.warn('Persistence:', err.code));
