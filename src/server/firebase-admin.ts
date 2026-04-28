import "server-only";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getStorage, type Storage } from "firebase-admin/storage";

let _app: App | null = null;

function getApp(): App {
  if (_app) return _app;

  const existing = getApps();
  if (existing.length > 0) {
    _app = existing[0];
    return _app;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  const storageBucket =
    process.env.FIREBASE_STORAGE_BUCKET ??
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Firebase Admin SDK credentials missing. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY env vars.",
    );
  }

  _app = initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey: privateKey.replace(/\\n/g, "\n"),
    }),
    storageBucket,
  });
  return _app;
}

/** Lazy-initialized Firebase Admin Auth */
export const adminAuth: Auth = new Proxy({} as Auth, {
  get(_, prop) {
    return (getAuth(getApp()) as unknown as Record<string | symbol, unknown>)[prop];
  },
});

/** Lazy-initialized Firestore */
export const adminDb: Firestore = new Proxy({} as Firestore, {
  get(_, prop) {
    return (getFirestore(getApp()) as unknown as Record<string | symbol, unknown>)[prop];
  },
});

/** Lazy-initialized Firebase Storage */
export const adminStorage: Storage = new Proxy({} as Storage, {
  get(_, prop) {
    return (getStorage(getApp()) as unknown as Record<string | symbol, unknown>)[prop];
  },
});

/** Default bucket (uses FIREBASE_STORAGE_BUCKET env) */
export function getBucket() {
  return adminStorage.bucket();
}
