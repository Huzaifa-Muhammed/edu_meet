"use client";

import {
  createContext,
  useCallback,
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
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthCtx>({
  firebaseUser: null,
  user: null,
  loading: true,
  refreshUser: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (fbUser: FirebaseUser) => {
    const pendingRole = readPendingRole();
    const profile = await api.post("/auth/session", {
      idToken: await fbUser.getIdToken(),
      ...(pendingRole ? { role: pendingRole } : {}),
    });
    clearPendingRole();
    return profile as unknown as User;
  }, []);

  useEffect(() => {
    const firebaseAuth = getFirebaseAuth();
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (fbUser) => {
      setLoading(true);
      setFirebaseUser(fbUser);

      if (fbUser) {
        try {
          setUser(await fetchProfile(fbUser));
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
  }, [fetchProfile]);

  const refreshUser = useCallback(async () => {
    const fbUser = getFirebaseAuth().currentUser;
    if (!fbUser) return;
    try {
      setUser(await fetchProfile(fbUser));
    } catch {
      // leave user as-is on transient failure
    }
  }, [fetchProfile]);

  return (
    <AuthContext value={{ firebaseUser, user, loading, refreshUser }}>
      {children}
    </AuthContext>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
