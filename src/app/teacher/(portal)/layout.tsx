"use client";

import { Topbar } from "@/components/layout/topbar";
import { Sidenav } from "@/components/layout/sidenav";

export default function TeacherPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Topbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidenav role="teacher" />
        <div className="flex flex-1 flex-col overflow-hidden">{children}</div>
      </div>
    </div>
  );
}
