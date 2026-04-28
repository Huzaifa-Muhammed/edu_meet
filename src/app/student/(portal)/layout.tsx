"use client";
export const dynamic = "force-dynamic";

import { usePathname } from "next/navigation";
import { StudentTopbar } from "@/components/student/student-topbar";
import { StudentSidenav } from "@/components/student/student-sidenav";
import { StudentRightSidebar } from "@/components/student/student-right-sidebar";

export default function StudentPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  // Hide the right rail on non-primary pages to keep them focused
  const showRightRail =
    pathname === "/student/dashboard" ||
    pathname === "/student/wallet" ||
    pathname === "/student/progress" ||
    pathname === "/student/offers" ||
    pathname === "/student/support";

  return (
    <div className="flex flex-1 overflow-hidden">
      <StudentSidenav />
      <div className="flex flex-1 flex-col overflow-hidden">
        <StudentTopbar />
        <div className="flex flex-1 overflow-hidden">
          <main className="flex-1 overflow-y-auto">{children}</main>
          {showRightRail && <StudentRightSidebar />}
        </div>
      </div>
    </div>
  );
}
