/* ──────────── Firebase ──────────── */
const firebaseConfig = {
    apiKey: "AIzaSyBG7-1BtlTaBhoGxeBofbHz2v_klWgkbZ4",
    authDomain: "congelacao-572a1.firebaseapp.com",
    projectId: "congelacao-572a1",
    storageBucket: "congelacao-572a1.firebasestorage.app",
    messagingSenderId: "506743282639",
    appId: "1:506743282639:web:e51f4ccdd3d0b7d44290ba",
    measurementId: "G-RE8HBBVPTP"
};
firebase.initializeApp(firebaseConfig);
const db  = firebase.firestore();
const auth = firebase.auth();

// Cache dados offline automaticamente
db.enablePersistence({ synchronizeTabs: true })
  .catch(err => console.warn('Persistence:', err.code));
