"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCurrentUser } from "@/hooks/use-current-user";
import { cn } from "@/lib/utils/cn";

type Item = { emoji: string; label: string; href: string };

const nav: Item[] = [
  { emoji: "🏠", label: "Home", href: "/student/dashboard" },
  { emoji: "🪙", label: "Wallet", href: "/student/wallet" },
  { emoji: "📈", label: "Progress", href: "/student/progress" },
  { emoji: "🎁", label: "Offers", href: "/student/offers" },
  { emoji: "📝", label: "Assessments", href: "/student/assessments" },
  { emoji: "🎮", label: "Gaming", href: "/student/gaming" },
  { emoji: "🆘", label: "Support", href: "/student/support" },
];

export function StudentSidenav() {
  const pathname = usePathname();
  const { user } = useCurrentUser();
  const initials =
    user?.displayName
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() ?? "?";

  return (
    <nav
      className="flex w-[60px] flex-shrink-0 flex-col items-center bg-sidenav py-3"
      style={{ borderRight: "1px solid rgba(255,255,255,.06)" }}
    >
      {/* Logo */}
      <div className="mb-5">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-[9px]"
          style={{ background: "linear-gradient(135deg,#6366F1,#8B5CF6)" }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="white">
            <rect x="1" y="1" width="5" height="5" rx="1" />
            <rect x="8" y="1" width="5" height="5" rx="1" />
            <rect x="1" y="8" width="5" height="5" rx="1" />
            <rect x="8" y="8" width="5" height="5" rx="1" />
          </svg>
        </div>
      </div>

      {/* Items */}
      <div className="flex flex-1 flex-col items-center gap-1">
        {nav.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group relative flex h-10 w-10 items-center justify-center rounded-[10px] text-[18px] transition-all",
                active
                  ? "text-[#818CF8]"
                  : "text-white/35 hover:bg-white/[.06] hover:text-white/70",
              )}
              style={
                active
                  ? {
                      background: "rgba(99,102,241,.2)",
                      boxShadow: "0 0 0 1px rgba(99,102,241,.3)",
                    }
                  : undefined
              }
              title={item.label}
            >
              <span>{item.emoji}</span>
              <span className="pointer-events-none absolute left-[calc(100%+8px)] top-1/2 z-50 -translate-y-1/2 whitespace-nowrap rounded-md bg-black/90 px-2 py-1 text-[10px] text-white/90 opacity-0 transition-opacity group-hover:opacity-100">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>

      {/* Avatar at bottom */}
      <Link
        href="/student/profile"
        className="flex h-8 w-8 items-center justify-center rounded-full border-2 text-[11px] font-bold text-white"
        style={{
          background: "linear-gradient(135deg,#6366F1,#8B5CF6)",
          borderColor: "rgba(99,102,241,.5)",
        }}
        title={user?.displayName ?? "Profile"}
      >
        {initials}
      </Link>
    </nav>
  );
}
