import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
};

let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _db: Firestore | null = null;

function getApp(): FirebaseApp {
  if (_app) return _app;
  const existing = getApps();
  _app = existing.length > 0 ? existing[0] : initializeApp(firebaseConfig);
  return _app;
}

export function getFirebaseAuth(): Auth {
  if (_auth) return _auth;
  _auth = getAuth(getApp());
  return _auth;
}

export function getFirebaseDb(): Firestore {
  if (_db) return _db;
  _db = getFirestore(getApp());
  return _db;
}

// Lazy getters for backward compat — only used on the client
export const auth = typeof window !== "undefined"
  ? getFirebaseAuth()
  : (null as unknown as Auth);

export const db = typeof window !== "undefined"
  ? getFirebaseDb()
  : (null as unknown as Firestore);

export default getApp;
