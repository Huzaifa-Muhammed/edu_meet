"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LayoutDashboard, BookOpen, BarChart3, User } from "lucide-react";

type ToolState = {
  whiteboardOn: boolean;
  pointerOn: boolean;
  muteAllOn: boolean;
};

export function ClassroomSidenav({
  tools,
  onToggleWhiteboard,
  onTogglePointer,
  onToggleMuteAll,
}: {
  tools: ToolState;
  onToggleWhiteboard: () => void;
  onTogglePointer: () => void;
  onToggleMuteAll: () => void;
}) {
  const router = useRouter();

  return (
    <nav
      className="flex w-[52px] flex-shrink-0 flex-col items-center gap-[3px] border-r py-3"
      style={{ background: "#1E293B", borderColor: "#1E293B" }}
    >
      {/* Portal nav items */}
      <NavItem
        href="/teacher/dashboard"
        tip="Dashboard"
        onClick={() => router.push("/teacher/dashboard")}
      >
        <LayoutDashboard className="h-3.5 w-3.5" />
      </NavItem>
      <NavItem tip="Classroom" active>
        <BookOpen className="h-3.5 w-3.5" />
      </NavItem>
      <NavItem
        href="/teacher/reports"
        tip="Reports"
        onClick={() => router.push("/teacher/reports")}
      >
        <BarChart3 className="h-3.5 w-3.5" />
      </NavItem>

      <div className="my-[5px] h-px w-[18px] bg-white/10" />

      {/* Classroom tool buttons */}
      <ToolButton tip="Whiteboard" on={tools.whiteboardOn} onClick={onToggleWhiteboard}>
        <svg
          width="15"
          height="15"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <rect x="1" y="2" width="14" height="10" rx="1.5" />
          <path d="M4 13h8M8 12v1M4 6l2.5 2.5L10 5" />
        </svg>
      </ToolButton>
      <ToolButton tip="Pointer tool" on={tools.pointerOn} onClick={onTogglePointer}>
        <svg
          width="15"
          height="15"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M4 2l9 7-5 .5L5.5 14 4 2z" />
        </svg>
      </ToolButton>
      <ToolButton
        tip="Mute all students"
        danger
        onClick={onToggleMuteAll}
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M8 1a2.5 2.5 0 0 1 2.5 2.5v3A2.5 2.5 0 0 1 5.5 6.5v-3A2.5 2.5 0 0 1 8 1z" />
          <path d="M3 7a5 5 0 0 0 10 0" />
          <line x1="2" y1="2" x2="14" y2="14" />
        </svg>
      </ToolButton>

      {/* Profile bottom */}
      <NavItem
        href="/teacher/profile"
        tip="Profile"
        onClick={() => router.push("/teacher/profile")}
        className="mt-auto"
      >
        <User className="h-3.5 w-3.5" />
      </NavItem>
    </nav>
  );
}

function NavItem({
  children,
  tip,
  href,
  active,
  onClick,
  className = "",
}: {
  children: React.ReactNode;
  tip: string;
  href?: string;
  active?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  const inner = (
    <div
      onClick={onClick}
      className={`group relative flex h-[34px] w-[34px] cursor-pointer items-center justify-center rounded-[9px] transition-colors ${
        active
          ? "bg-white/[.14] text-white"
          : "text-white/30 hover:bg-white/10 hover:text-white/70"
      } ${className}`}
    >
      {children}
      <span className="pointer-events-none absolute left-[calc(100%+8px)] top-1/2 z-[100] -translate-y-1/2 whitespace-nowrap rounded-[5px] bg-[#111] px-2 py-1 text-[10px] text-white/90 opacity-0 transition-opacity group-hover:opacity-100">
        {tip}
      </span>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

function ToolButton({
  children,
  tip,
  on,
  danger,
  onClick,
}: {
  children: React.ReactNode;
  tip: string;
  on?: boolean;
  danger?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`group relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-[10px] transition-colors ${
        on
          ? "bg-amber-400/25 text-amber-200"
          : danger
            ? "bg-red-600/[.18] text-red-300 hover:bg-red-600/30"
            : "text-white/40 hover:bg-white/10 hover:text-white/80"
      }`}
    >
      {children}
      <span className="pointer-events-none absolute left-[calc(100%+8px)] top-1/2 z-[100] -translate-y-1/2 whitespace-nowrap rounded-[5px] bg-[#111] px-2 py-1 text-[10px] text-white/90 opacity-0 transition-opacity group-hover:opacity-100">
        {tip}
      </span>
    </div>
  );
}
