import { initializeApp } from "firebase/app";
import {
  getDatabase,
  get,
  onValue,
  push,
  ref,
  serverTimestamp,
  set,
} from "firebase/database";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyD9rSq5UZGBtB2o-h7R_VwseH6ih1oG-X0",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "asdf-770ae.firebaseapp.com",
  databaseURL: import.meta.env.VITE_FIREBASE_DB_URL || "https://asdf-770ae-default-rtdb.firebaseio.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "asdf-770ae",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "asdf-770ae.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "232399308126",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:232399308126:web:1618eb6e474b8eac083bcf",
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const dayKey = () => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

export function subscribeState(callback) {
  const key = dayKey();
  const path = ref(db, `events/${key}`);
  const unsubscribe = onValue(
    path,
    (snap) => {
      const val = snap.val() || {};
      const events = Object.entries(val)
        .map(([id, payload]) => ({ id, ...payload }))
        .sort((a, b) => (a.created_at || 0) > (b.created_at || 0) ? 1 : -1);
      callback({ day: key, events });
    },
    (err) => {
      console.error("Firebase subscribe error", err);
    },
  );
  return unsubscribe;
}

export async function sendEvent(event) {
  const key = dayKey();
  const path = ref(db, `events/${key}`);
  const item = {
    ...event,
    created_at: serverTimestamp(),
  };
  await push(path, item);
  // ensure day node exists even if empty
  await set(ref(db, `days/${key}`), true);
  return { day: key };
}

export async function fetchDay() {
  const key = dayKey();
  await set(ref(db, `days/${key}`), true);
  return { day: key };
}

export async function clearEvents() {
  const key = dayKey();
  const path = ref(db, `events/${key}`);
  await set(path, null);
  return { day: key };
}

