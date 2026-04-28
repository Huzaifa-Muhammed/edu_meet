"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "./use-current-user";

export function useRoleGuard(allowedRoles: string[]) {
  const { user, loading } = useCurrentUser();
  const router = useRouter();

  useEffect(() => {
    if (!loading && (!user || !allowedRoles.includes(user.role))) {
      router.replace("/auth/login");
    }
  }, [user, loading, allowedRoles, router]);

  return { user, loading, authorized: !!user && allowedRoles.includes(user.role) };
}
