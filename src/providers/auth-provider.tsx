"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { onAuthStateChanged, type User as FirebaseUser } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase/client";
import type { User } from "@/shared/types/domain";
import api from "@/lib/api/client";
import { readPendingRole, clearPendingRole } from "@/lib/api/auth";

interface AuthCtx {
  firebaseUser: FirebaseUser | null;
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthCtx>({
  firebaseUser: null,
  user: null,
  loading: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const firebaseAuth = getFirebaseAuth();
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (fbUser) => {
      setLoading(true);
      setFirebaseUser(fbUser);

      if (fbUser) {
        try {
          const pendingRole = readPendingRole();
          const profile = await api.post("/auth/session", {
            idToken: await fbUser.getIdToken(),
            ...(pendingRole ? { role: pendingRole } : {}),
          });
          clearPendingRole();
          setUser(profile as unknown as User);
        } catch {
          setUser(null);
        }
      } else {
        clearPendingRole();
        setUser(null);
      }

      setLoading(false);
    });

    return unsubscribe;
  }, []);

  return (
    <AuthContext value={{ firebaseUser, user, loading }}>
      {children}
    </AuthContext>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
