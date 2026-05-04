"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { format } from "date-fns";
import { useCurrentUser } from "@/hooks/use-current-user";
import { signOut } from "@/lib/api/auth";
import { ChevronDown, LogOut, Shield } from "lucide-react";

function titlesFor(pathname: string): { title: string; sub: string } {
  if (pathname.startsWith("/admin/users"))
    return { title: "User Management", sub: "Teachers, students, and access control" };
  if (pathname.startsWith("/admin/applications"))
    return {
      title: "Teacher Applications",
      sub: "Review and approve new teacher signups",
    };
  if (pathname.startsWith("/admin/reports"))
    return { title: "Support Reports", sub: "Tickets submitted by students" };
  return {
    title: "Admin Dashboard",
    sub: "Platform health & operations at a glance",
  };
}

export function AdminTopbar() {
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

  const { title, sub } = titlesFor(pathname);
  const initials =
    user?.displayName
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() ?? "A";
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
          background: "rgba(56,189,248,.15)",
          border: "1px solid rgba(56,189,248,.3)",
        }}
      >
        <Shield className="h-3.5 w-3.5 text-[#7DD3FC]" />
        <span>Admin</span>
      </div>

      <div
        className="flex items-center rounded-full px-[10px] py-[5px]"
        style={{ background: "rgba(255,255,255,.06)" }}
      >
        <span className="text-[11px] font-semibold text-white/70">
          {formattedDate}
        </span>
      </div>

      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setMenuOpen((o) => !o)}
          className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-white/10"
        >
          <div
            className="flex h-[30px] w-[30px] items-center justify-center rounded-full text-[11px] font-bold text-white"
            style={{
              background: "linear-gradient(135deg,#38BDF8,#0EA5E9)",
              border: "2px solid rgba(56,189,248,.5)",
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
              background: "#0F1B2E",
              border: "1px solid rgba(255,255,255,.1)",
            }}
          >
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
