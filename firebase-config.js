// ============================================================
// FIREBASE CONFIGURATION — fill in your project credentials
// ============================================================
//
// SETUP INSTRUCTIONS:
// 1. Go to console.firebase.google.com → create a new project
// 2. Project Settings (gear icon) → General → "Your apps" → Add app → Web (</>)
//    Copy the firebaseConfig object values into the fields below.
// 3. Authentication → Sign-in method → Enable "Google"
// 4. Firestore Database → Create database (start in production mode)
//    Choose a region close to you.
// 5. Storage → Get started (accept defaults)
// 6. Firestore → Rules tab → paste the contents of firestore.rules → Publish
// 7. Firestore → Data tab → Start collection → Collection ID: "adminEmails"
//    Add first document:
//      Document ID: your.gmail@gmail.com   (your actual Gmail address)
//      Field: email  (string) → your.gmail@gmail.com
//    This makes YOU the first admin.
// 8. Open admin.html in a browser, sign in with that Gmail, and manage everything.
//
// ============================================================

const firebaseConfig = {
  apiKey: "AIzaSyCgvsWoo7uIsnVmzlD7ZUHRPyi9NewDB6o", 
  authDomain: "laputa-journal.firebaseapp.com",
  projectId: "laputa-journal",
  storageBucket: "laputa-journal.firebasestorage.app",
  messagingSenderId: "1077918751296",
  appId: "1:1077918751296:web:96cc6b92607d36708c1da5",
  measurementId: "G-V6BWWVH1X9"
};

firebase.initializeApp(firebaseConfig);

// Public pages load only the Firestore SDK; the admin page also loads Auth +
// Storage. Guard so a page can include just what it needs.
const db      = firebase.firestore();
const auth    = (typeof firebase.auth    === 'function') ? firebase.auth()    : null;
const storage = (typeof firebase.storage === 'function') ? firebase.storage() : null;
