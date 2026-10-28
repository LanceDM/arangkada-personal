import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';

// A checkout with no Firebase key in its `.env` runs against the local
// emulators rather than failing to start. A production build always carries
// the key, so this branch is compiled out of it; one built without the key
// would hold the emulator settings, which the pilot's build check refuses.
const configured = !!import.meta.env.VITE_FIREBASE_API_KEY;
const useEmulator = import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true' || !configured;

// The Firestore/Auth emulators treat any "demo-"-prefixed project id as
// fully local-only by convention - no real credentials or live project
// config needed, and no possible path to the real production database.
const firebaseConfig = useEmulator
  ? { apiKey: 'fake-api-key-for-emulator', projectId: 'demo-arangkada', authDomain: 'demo-arangkada.firebaseapp.com' }
  : {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
    };

export const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

/** Whether this build talks to the local emulators. */
export const usingEmulator = useEmulator;

if (useEmulator) {
  if (!configured && import.meta.env.VITE_USE_FIREBASE_EMULATOR !== 'true') {
    console.info('No Firebase key in .env: using the local emulators. Start them with `npm run emulators`.');
  }
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}