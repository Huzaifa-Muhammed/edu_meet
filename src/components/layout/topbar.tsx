"use client";

import { useRouter } from "next/navigation";
import { useCurrentUser } from "@/hooks/use-current-user";
import { signOut } from "@/lib/api/auth";
import {
  LogOut,
  User,
  ChevronDown,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";

export function Topbar() {
  const { user } = useCurrentUser();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function handleSignOut() {
    await signOut();
    router.push("/auth/login");
  }

  const initials = user?.displayName
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() ?? "?";

  return (
    <header className="flex h-[50px] items-center gap-3 border-b border-[#1A1917] bg-topbar px-4">
      {/* Logo */}
      <div className="flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-acc">
          <svg width="11" height="11" viewBox="0 0 14 14" fill="white">
            <rect x="1" y="1" width="5" height="5" rx="1" />
            <rect x="8" y="1" width="5" height="5" rx="1" />
            <rect x="1" y="8" width="5" height="5" rx="1" />
            <rect x="8" y="8" width="5" height="5" rx="1" />
          </svg>
        </div>
        <span className="text-[13px] font-semibold text-white/90">EduMeet</span>
      </div>

      <div className="flex-1" />

      {/* User avatar + dropdown */}
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="flex items-center gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-white/10"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-white/15 text-[11px] font-semibold text-white/80">
            {initials}
          </div>
          <span className="text-xs text-white/60">{user?.displayName}</span>
          <ChevronDown className="h-3 w-3 text-white/40" />
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-lg border border-bd bg-surf py-1 shadow-lg">
            <button
              onClick={() => {
                setMenuOpen(false);
                router.push(`/${user?.role}/profile`);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-t2 hover:bg-panel"
            >
              <User className="h-3.5 w-3.5" />
              Profile
            </button>
            <button
              onClick={handleSignOut}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-red hover:bg-panel"
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
