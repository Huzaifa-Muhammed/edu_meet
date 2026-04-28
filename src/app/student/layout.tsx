"use client";
export const dynamic = "force-dynamic";

import { useRoleGuard } from "@/hooks/use-role-guard";

export default function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { loading, authorized } = useRoleGuard(["student"]);

  if (loading) {
    return (
      <div className="student-ui flex h-screen items-center justify-center bg-bg">
        <div className="text-sm text-t3">Loading...</div>
      </div>
    );
  }
  if (!authorized) return null;

  return <div className="student-ui flex h-screen flex-col overflow-hidden bg-bg">{children}</div>;
}
