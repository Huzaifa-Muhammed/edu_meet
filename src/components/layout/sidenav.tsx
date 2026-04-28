"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BookOpen,
  Users,
  BarChart3,
  FileText,
  GraduationCap,
  FolderOpen,
  ClipboardList,
  User,
  Video,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface NavItem {
  icon: React.ReactNode;
  label: string;
  href: string;
}

const navByRole: Record<string, NavItem[]> = {
  teacher: [
    { icon: <LayoutDashboard className="h-3.5 w-3.5" />, label: "Dashboard", href: "/teacher/dashboard" },
    { icon: <Video className="h-3.5 w-3.5" />, label: "Classes", href: "/teacher/classes" },
    { icon: <BarChart3 className="h-3.5 w-3.5" />, label: "Reports", href: "/teacher/reports" },
    { icon: <User className="h-3.5 w-3.5" />, label: "Profile", href: "/teacher/profile" },
  ],
  student: [
    { icon: <LayoutDashboard className="h-3.5 w-3.5" />, label: "Dashboard", href: "/student/dashboard" },
    { icon: <ClipboardList className="h-3.5 w-3.5" />, label: "Assessments", href: "/student/assessments" },
    { icon: <User className="h-3.5 w-3.5" />, label: "Profile", href: "/student/profile" },
  ],
  admin: [
    { icon: <LayoutDashboard className="h-3.5 w-3.5" />, label: "Dashboard", href: "/admin/users" },
    { icon: <Users className="h-3.5 w-3.5" />, label: "Users", href: "/admin/users" },
    { icon: <GraduationCap className="h-3.5 w-3.5" />, label: "Subjects", href: "/admin/subjects" },
    { icon: <FolderOpen className="h-3.5 w-3.5" />, label: "Agendas", href: "/admin/agendas" },
    { icon: <FileText className="h-3.5 w-3.5" />, label: "Resources", href: "/admin/resources" },
    { icon: <BarChart3 className="h-3.5 w-3.5" />, label: "Analytics", href: "/admin/analytics" },
  ],
};

export function Sidenav({ role }: { role: string }) {
  const pathname = usePathname();
  const items = navByRole[role] ?? [];

  return (
    <nav className="flex w-[52px] flex-col items-center gap-1 border-r border-sidebd bg-sidenav py-3">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "group relative flex h-[34px] w-[34px] items-center justify-center rounded-[9px] text-white/30 transition-all",
              active
                ? "bg-white/14 text-white"
                : "hover:bg-white/10 hover:text-white/70",
            )}
          >
            {item.icon}
            <span className="pointer-events-none absolute left-[calc(100%+8px)] top-1/2 z-50 -translate-y-1/2 whitespace-nowrap rounded-[5px] bg-[#111] px-2 py-1 text-[10px] text-white/90 opacity-0 transition-opacity group-hover:opacity-100">
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
