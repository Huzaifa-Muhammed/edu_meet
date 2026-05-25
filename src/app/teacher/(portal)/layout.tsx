"use client";

import { usePathname } from "next/navigation";
import { TeacherTopbar } from "@/components/teacher/teacher-topbar";
import { TeacherSidenav } from "@/components/teacher/teacher-sidenav";
import { TeacherRightSidebar } from "@/components/teacher/teacher-right-sidebar";

export default function TeacherPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const showRightRail = pathname === "/teacher/dashboard";

  return (
    <div className="flex flex-1 overflow-hidden">
      <TeacherSidenav />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TeacherTopbar />
        <div className="flex flex-1 overflow-hidden">
          <main className="flex-1 overflow-y-auto">{children}</main>
          {showRightRail && <TeacherRightSidebar />}
        </div>
      </div>
    </div>
  );
}
