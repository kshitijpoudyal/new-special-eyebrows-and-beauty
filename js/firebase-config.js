// ============================================================
// FIREBASE CONFIGURATION
// Firebase console → Project settings → General → Your apps → Web app
// Paste the values below. (These are public identifiers, not secrets —
// your data is protected by firestore.rules.)
// ============================================================
export const firebaseConfig = {
  apiKey:            'YOUR_API_KEY',
  authDomain:        'YOUR_PROJECT_ID.firebaseapp.com',
  projectId:         'YOUR_PROJECT_ID',
  storageBucket:     'YOUR_PROJECT_ID.appspot.com',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId:             'YOUR_APP_ID',
};
// ============================================================

import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js';
import { getFirestore, connectFirestoreEmulator } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js';

export const isConfigured = !String(firebaseConfig.apiKey).startsWith('YOUR_');

// Local testing: open any page as http://localhost:PORT/page.html?emulator
// to use the Firebase Local Emulator Suite instead of the live project.
export const useEmulator =
  new URLSearchParams(location.search).has('emulator') &&
  ['localhost', '127.0.0.1'].includes(location.hostname);

let app = null, db = null;
if (isConfigured || useEmulator) {
  app = initializeApp(useEmulator && !isConfigured
    ? { apiKey: 'demo-key', projectId: 'demo-salon', authDomain: 'localhost' }
    : firebaseConfig);
  db = getFirestore(app);
  if (useEmulator) connectFirestoreEmulator(db, '127.0.0.1', 8080);
}
export { app, db };
