"use client";
export const dynamic = "force-dynamic";

import { useRoleGuard } from "@/hooks/use-role-guard";
import { Topbar } from "@/components/layout/topbar";
import { Sidenav } from "@/components/layout/sidenav";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { loading, authorized } = useRoleGuard(["admin"]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg">
        <div className="text-sm text-t3">Loading...</div>
      </div>
    );
  }

  if (!authorized) return null;

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Topbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidenav role="admin" />
        <div className="flex flex-1 flex-col overflow-hidden">{children}</div>
      </div>
    </div>
  );
}
