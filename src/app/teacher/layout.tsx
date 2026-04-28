"use client";
export const dynamic = "force-dynamic";

import { useRoleGuard } from "@/hooks/use-role-guard";

export default function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { loading, authorized } = useRoleGuard(["teacher"]);

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
