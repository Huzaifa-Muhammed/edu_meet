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
    // Accept either field — `status` is canonical, `applicationStatus` is
    // mirrored for back-compat with older code paths.
    const approved =
      user.status === "approved" || user.applicationStatus === "approved";

    if (!approved && !onApplyPage) {
      router.replace("/teacher/apply");
    }
    if (approved && onApplyPage) {
      router.replace("/teacher/dashboard");
    }
  }, [loading, authorized, user, pathname, router]);

  if (loading) {
    return (
      <div className="teacher-ui flex h-screen items-center justify-center bg-bg">
        <div className="text-sm text-t3">Loading...</div>
      </div>
    );
  }

  if (!authorized) return null;

  return (
    <div className="teacher-ui flex h-screen flex-col overflow-hidden bg-bg">
      {children}
    </div>
  );
}
