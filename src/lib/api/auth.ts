import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
} from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase/client";
import api from "@/lib/api/client";

export async function signIn(email: string, password: string) {
  const cred = await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
  const idToken = await cred.user.getIdToken();
  return api.post("/auth/session", { idToken });
}

const PENDING_ROLE_KEY = "__edumeet_pending_role";

export function readPendingRole(): "teacher" | "student" | undefined {
  if (typeof window === "undefined") return undefined;
  const v = sessionStorage.getItem(PENDING_ROLE_KEY);
  if (v === "teacher" || v === "student") return v;
  return undefined;
}

export function clearPendingRole() {
  if (typeof window !== "undefined") {
    sessionStorage.removeItem(PENDING_ROLE_KEY);
  }
}

export async function signUp(
  email: string,
  password: string,
  displayName: string,
  role: "teacher" | "student",
) {
  if (typeof window !== "undefined") {
    sessionStorage.setItem(PENDING_ROLE_KEY, role);
  }
  const cred = await createUserWithEmailAndPassword(getFirebaseAuth(), email, password);
  await updateProfile(cred.user, { displayName });
  const idToken = await cred.user.getIdToken();
  return api.post("/auth/session", { idToken, role });
}

export async function signOut() {
  await firebaseSignOut(getFirebaseAuth());
}
