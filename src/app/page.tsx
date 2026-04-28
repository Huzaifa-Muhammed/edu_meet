"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "@/hooks/use-current-user";

export default function Home() {
  const { user, loading } = useCurrentUser();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    if (user) {
      router.replace(`/${user.role}/dashboard`);
    } else {
      router.replace("/auth/login");
    }
  }, [user, loading, router]);

  return (
    <div className="flex h-screen items-center justify-center bg-bg">
      <div className="text-sm text-t3">Loading...</div>
    </div>
  );
}
