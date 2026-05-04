"use client";
export const dynamic = "force-dynamic";

import { useRoleGuard } from "@/hooks/use-role-guard";
import { AdminSidenav } from "@/components/admin/admin-sidenav";
import { AdminTopbar } from "@/components/admin/admin-topbar";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { loading, authorized } = useRoleGuard(["admin"]);

  if (loading) {
    return (
      <div className="admin-ui flex h-screen items-center justify-center bg-bg">
        <div className="text-sm text-t3">Loading...</div>
      </div>
    );
  }

  if (!authorized) return null;

  return (
    <div className="admin-ui flex h-screen flex-col overflow-hidden bg-bg">
      <div className="flex flex-1 overflow-hidden">
        <AdminSidenav />
        <div className="flex flex-1 flex-col overflow-hidden">
          <AdminTopbar />
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
    </div>
  );
}
