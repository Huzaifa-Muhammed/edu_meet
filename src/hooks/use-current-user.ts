"use client";

import { useAuth } from "@/providers/auth-provider";

export function useCurrentUser() {
  const { user, firebaseUser, loading } = useAuth();
  return { user, firebaseUser, loading, isAuthenticated: !!user };
}
