"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { useCurrentUser } from "@/hooks/use-current-user";
import { signOut } from "@/lib/api/auth";
import api from "@/lib/api/client";
import {
  ChevronDown,
  Coins,
  LogOut,
  Palette,
  User as UserIcon,
} from "lucide-react";

type Theme = "default" | "forest";
const THEME_KEY = "edumeet:student:theme";

/** Pull page title + subtitle from pathname so the topbar updates as the user
 * navigates. Matches the mockup's dynamic titles. */
function titlesFor(pathname: string, firstName: string): {
  title: string;
  sub: string;
} {
  if (pathname.startsWith("/student/wallet"))
    return { title: "Brain Token Wallet", sub: "Earn, spend & track Brain Tokens" };
  if (pathname.startsWith("/student/progress"))
    return { title: "My Progress", sub: "Track your learning journey" };
  if (pathname.startsWith("/student/offers"))
    return { title: "Offers & Rewards", sub: "Redeem Brain Tokens for rewards" };
  if (pathname.startsWith("/student/support"))
    return { title: "Report a Problem", sub: "We're here to help" };
  if (pathname.startsWith("/student/gaming"))
    return { title: "Gaming Room", sub: "Learn by playing" };
  if (pathname.startsWith("/student/assessments"))
    return { title: "Assessments", sub: "Tasks your teachers assigned" };
  if (pathname.startsWith("/student/profile"))
    return { title: "My Profile", sub: "Personal info & settings" };
  return {
    title: "Dashboard & Schedule",
    sub: `Welcome back, ${firstName} — here is your day at a glance`,
  };
}

export function StudentTopbar() {
  const { user } = useCurrentUser();
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>("default");
  const menuRef = useRef<HTMLDivElement>(null);
  const themeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = (localStorage.getItem(THEME_KEY) as Theme | null) ?? "default";
    setTheme(saved);
    applyTheme(saved);
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node))
        setMenuOpen(false);
      if (themeRef.current && !themeRef.current.contains(e.target as Node))
        setThemeOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const walletQ = useQuery({
    queryKey: ["student", "wallet-balance"],
    queryFn: async () => {
      const res = (await api.get("/student/wallet")) as unknown as {
        tokens: { balance: number };
      };
      return res.tokens.balance;
    },
    enabled: !!user,
    refetchInterval: 30_000,
  });

  function applyTheme(t: Theme) {
    const root = document.querySelector<HTMLElement>(".student-ui");
    if (!root) return;
    if (t === "default") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", t);
  }

  function pickTheme(t: Theme) {
    setTheme(t);
    localStorage.setItem(THEME_KEY, t);
    applyTheme(t);
    setThemeOpen(false);
  }

  async function onSignOut() {
    await signOut();
    router.push("/auth/login");
  }

  const firstName = user?.displayName?.split(" ")[0] ?? "Student";
  const { title, sub } = titlesFor(pathname, firstName);

  const initials =
    user?.displayName
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() ?? "?";

  // Get today's actual date
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

      {/* Date display */}
      <div
        className="flex items-center rounded-full px-[10px] py-[5px]"
        style={{ background: "rgba(255,255,255,.06)" }}
      >
        <span className="text-[11px] font-semibold text-white/70">
          {formattedDate}
        </span>
      </div>

      {/* BT pill */}
      <div
        className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold text-white/95"
        style={{ background: "rgba(99,102,241,.15)", border: "1px solid rgba(99,102,241,.3)" }}
        title="Brain Token balance"
      >
        <Coins className="h-3.5 w-3.5 text-[#FACC15]" />
        <span>{walletQ.data ?? 0} BT</span>
      </div>

      {/* Theme switcher */}
      <div className="relative" ref={themeRef}>
        <button
          onClick={() => setThemeOpen((o) => !o)}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-white/70 hover:bg-white/10"
          title="Theme"
        >
          <Palette className="h-3.5 w-3.5" />
          <span
            className="h-3 w-3 rounded-full"
            style={{
              border: "1px solid rgba(255,255,255,.3)",
              background: theme === "forest" ? "#22C55E" : "#6366F1",
            }}
          />
        </button>
        {themeOpen && (
          <div
            className="absolute right-0 top-full z-50 mt-1 w-40 rounded-lg py-1 shadow-lg"
            style={{
              background: "#1A1633",
              border: "1px solid rgba(255,255,255,.1)",
            }}
          >
            <ThemeRow label="Indigo" color="#6366F1" active={theme === "default"} onClick={() => pickTheme("default")} />
            <ThemeRow label="Forest" color="#22C55E" active={theme === "forest"} onClick={() => pickTheme("forest")} />
            <div
              className="px-3 py-2 text-[10px] text-white/40"
              style={{ borderTop: "1px solid rgba(255,255,255,.08)" }}
            >
              More unlock in Offers.
            </div>
          </div>
        )}
      </div>

      {/* Avatar menu */}
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setMenuOpen((o) => !o)}
          className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-white/10"
        >
          <div
            className="flex h-[30px] w-[30px] items-center justify-center rounded-full text-[11px] font-bold text-white"
            style={{
              background: "linear-gradient(135deg,#6366F1,#8B5CF6)",
              border: "2px solid rgba(99,102,241,.5)",
            }}
          >
            {initials}
          </div>
          <ChevronDown className="h-3 w-3 text-white/40" />
        </button>

        {menuOpen && (
          <div
            className="absolute right-0 top-full z-50 mt-1 w-44 rounded-lg py-1 shadow-lg"
            style={{ background: "#1A1633", border: "1px solid rgba(255,255,255,.1)" }}
          >
            <button
              onClick={() => {
                setMenuOpen(false);
                router.push("/student/profile");
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

function ThemeRow({
  label,
  color,
  active,
  onClick,
}: {
  label: string;
  color: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center justify-between px-3 py-2 text-left text-xs text-white/80 hover:bg-white/10"
    >
      <span className="flex items-center gap-2">
        <span
          className="h-3 w-3 rounded-full"
          style={{ background: color, border: "1px solid rgba(255,255,255,.15)" }}
        />
        {label}
      </span>
      {active && <span className="text-[10px] font-semibold text-[#A5B4FC]">Active</span>}
    </button>
  );
}