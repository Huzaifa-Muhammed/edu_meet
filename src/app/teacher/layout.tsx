"use client";
export const dynamic = "force-dynamic";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useRoleGuard } from "@/hooks/use-role-guard";
import { useCurrentUser } from "@/hooks/use-current-user";

export default function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { loading, authorized } = useRoleGuard(["teacher"]);
  const { user } = useCurrentUser();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading || !authorized || !user) return;
    const onApplyPage = pathname === "/teacher/apply";
    const approved = user.applicationStatus === "approved";

    if (!approved && !onApplyPage) {
      router.replace("/teacher/apply");
    }
    if (approved && onApplyPage) {
      router.replace("/teacher/dashboard");
    }
  }, [loading, authorized, user, pathname, router]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg">
        <div className="text-sm text-t3">Loading...</div>
      </div>
    );
  }

  if (!authorized) return null;

  return <>{children}</>;
}
