// ============================================================
// FIREBASE CONFIGURATION — francis-lin-blog
// ============================================================

const firebaseConfig = {
  apiKey: "AIzaSyBuw5OaLHHE7CVmIlpczJOIkYlJlUsoZLc",
  authDomain: "francislinblog.firebaseapp.com",
  projectId: "francislinblog",
  storageBucket: "francislinblog.firebasestorage.app",
  messagingSenderId: "849410050832",
  appId: "1:849410050832:web:8e259fd5087bdaa8883395",
  measurementId: "G-NG38Z74WSZ"
};

firebase.initializeApp(firebaseConfig);

// Public pages load only the Firestore SDK; the admin page also loads Auth +
// Storage. Guard so a page can include just what it needs.
const db      = firebase.firestore();
const auth    = (typeof firebase.auth    === 'function') ? firebase.auth()    : null;
const storage = (typeof firebase.storage === 'function') ? firebase.storage() : null;
