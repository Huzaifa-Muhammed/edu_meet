"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { format } from "date-fns";
import { useCurrentUser } from "@/hooks/use-current-user";
import { signOut } from "@/lib/api/auth";
import { ChevronDown, GraduationCap, LogOut, User as UserIcon } from "lucide-react";

function titlesFor(pathname: string, firstName: string): { title: string; sub: string } {
  if (pathname.startsWith("/teacher/classes"))
    return {
      title: "Live & Scheduled Classes",
      sub: "Start a class or jump back into a live one",
    };
  if (pathname.startsWith("/teacher/assessments"))
    return { title: "Assessments", sub: "Quizzes, tests and graded work" };
  if (pathname.startsWith("/teacher/grading"))
    return { title: "Grading Queue", sub: "Short-answer submissions awaiting your review" };
  if (pathname.startsWith("/teacher/students"))
    return { title: "Students", sub: "Everyone enrolled across your classes" };
  if (pathname.startsWith("/teacher/reports"))
    return {
      title: "Student Reports",
      sub: "Participation and performance across your classes",
    };
  if (pathname.startsWith("/teacher/analytics"))
    return { title: "Analytics", sub: "Engagement and score trends per class" };
  if (pathname.startsWith("/teacher/library"))
    return { title: "Resource Library", sub: "Reusable files and links across your classes" };
  if (pathname.startsWith("/teacher/templates"))
    return { title: "Lesson Templates", sub: "Reusable agendas you can apply to any classroom" };
  if (pathname.startsWith("/teacher/notifications"))
    return { title: "Notifications", sub: "Recent activity across your classes" };
  if (pathname.startsWith("/teacher/support"))
    return { title: "Support", sub: "Report a problem or get help" };
  if (pathname.startsWith("/teacher/profile"))
    return { title: "Profile & Settings", sub: "Personal info, subjects, credentials" };
  return {
    title: "Dashboard",
    sub: `Welcome back, ${firstName} — here is your teaching day`,
  };
}

export function TeacherTopbar() {
  const { user } = useCurrentUser();
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node))
        setMenuOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function onSignOut() {
    await signOut();
    router.push("/auth/login");
  }

  const firstName = user?.displayName?.split(" ")[0] ?? "Teacher";
  const { title, sub } = titlesFor(pathname, firstName);
  const initials =
    user?.displayName
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() ?? "T";
  const formattedDate = format(new Date(), "dd MMMM yyyy");

  return (
    <header
      className="flex h-[64px] flex-shrink-0 items-center gap-3 bg-topbar px-[22px]"
      style={{ borderBottom: "1px solid rgba(255,255,255,.06)" }}
    >
      <div className="min-w-0 flex-1">
        <p
          className="truncate text-[18px] font-extrabold text-white"
          style={{ letterSpacing: "-0.4px" }}
        >
          {title}
        </p>
        <p className="mt-0.5 truncate text-[11px] text-white/40">{sub}</p>
      </div>

      <div
        className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold text-white/95"
        style={{
          background: "rgba(245,158,11,.15)",
          border: "1px solid rgba(245,158,11,.3)",
        }}
      >
        <GraduationCap className="h-3.5 w-3.5 text-[#FCD34D]" />
        <span>Teacher</span>
      </div>

      <div
        className="flex items-center rounded-full px-[10px] py-[5px]"
        style={{ background: "rgba(255,255,255,.06)" }}
      >
        <span className="text-[11px] font-semibold text-white/70">{formattedDate}</span>
      </div>

      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setMenuOpen((o) => !o)}
          className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-white/10"
        >
          <div
            className="flex h-[30px] w-[30px] items-center justify-center rounded-full text-[11px] font-bold text-white"
            style={{
              background: "linear-gradient(135deg,#F59E0B,#D97706)",
              border: "2px solid rgba(245,158,11,.5)",
            }}
          >
            {initials}
          </div>
          <ChevronDown className="h-3 w-3 text-white/40" />
        </button>

        {menuOpen && (
          <div
            className="absolute right-0 top-full z-50 mt-1 w-44 rounded-lg py-1 shadow-lg"
            style={{
              background: "#1F1409",
              border: "1px solid rgba(255,255,255,.1)",
            }}
          >
            <button
              onClick={() => {
                setMenuOpen(false);
                router.push("/teacher/profile");
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-white/80 hover:bg-white/10"
            >
              <UserIcon className="h-3.5 w-3.5" />
              Profile
            </button>
            <button
              onClick={onSignOut}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-[#F87171] hover:bg-white/10"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
