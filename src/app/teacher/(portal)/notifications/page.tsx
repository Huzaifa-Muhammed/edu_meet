"use client";
export const dynamic = "force-dynamic";

import Link from "next/link";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import api from "@/lib/api/client";

type Notif = {
  id: string;
  kind: "question" | "submission" | "rejoin" | "application" | "system";
  title: string;
  body?: string;
  at: string;
  href?: string;
  read?: boolean;
};

const KIND_ICON: Record<Notif["kind"], { emoji: string; bg: string; color: string }> = {
  question: { emoji: "❓", bg: "rgba(99,102,241,.15)", color: "#A5B4FC" },
  submission: { emoji: "📝", bg: "rgba(74,222,128,.14)", color: "#4ADE80" },
  rejoin: { emoji: "🔁", bg: "rgba(245,158,11,.14)", color: "#FCD34D" },
  application: { emoji: "🎓", bg: "rgba(168,85,247,.14)", color: "#C4B5FD" },
  system: { emoji: "🛟", bg: "rgba(255,255,255,.06)", color: "rgba(255,255,255,.7)" },
};

const FILTERS: { id: "all" | Notif["kind"]; label: string }[] = [
  { id: "all", label: "All" },
  { id: "question", label: "Questions" },
  { id: "submission", label: "Submissions" },
  { id: "rejoin", label: "Rejoin" },
  { id: "application", label: "Application" },
];

export default function TeacherNotificationsPage() {
  const [filter, setFilter] = useState<"all" | Notif["kind"]>("all");

  const notifsQ = useQuery<Notif[]>({
    queryKey: ["teacher", "notifications"],
    queryFn: () =>
      api.get("/teacher/notifications") as unknown as Promise<Notif[]>,
    refetchInterval: 30_000,
  });

  const notifs = notifsQ.data ?? [];
  const filtered = useMemo(
    () => (filter === "all" ? notifs : notifs.filter((n) => n.kind === filter)),
    [notifs, filter],
  );
  const unread = notifs.filter((n) => !n.read).length;

  return (
    <div className="min-h-full bg-bg p-6">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex flex-wrap items-center gap-1 rounded-lg bg-panel p-1">
          {FILTERS.map((f) => {
            const count =
              f.id === "all"
                ? notifs.length
                : notifs.filter((n) => n.kind === f.id).length;
            return (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-medium ${
                  filter === f.id ? "bg-surf text-t shadow-sm" : "text-t3"
                }`}
              >
                {f.label}
                {count > 0 && (
                  <span
                    className="rounded-full px-1.5 py-px text-[9px] font-bold"
                    style={{
                      background:
                        filter === f.id ? "rgba(245,158,11,.18)" : "rgba(255,255,255,.06)",
                      color: filter === f.id ? "#FCD34D" : "rgba(255,255,255,.5)",
                    }}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
          <div className="ml-auto pr-2 text-[11px] text-t3">
            {unread > 0 ? `${unread} new in last 24h` : "All caught up"}
          </div>
        </div>

        {notifsQ.isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-panel" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-bd bg-surf py-20 text-center">
            <div
              className="mb-3 flex h-12 w-12 items-center justify-center rounded-full text-[22px]"
              style={{ background: "rgba(255,255,255,.06)" }}
            >
              🔕
            </div>
            <h3 className="text-sm font-semibold text-t">No notifications</h3>
            <p className="mt-1 text-xs text-t3">Quiet for now. Check back later.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((n) => {
              const ico = KIND_ICON[n.kind];
              const Inner = (
                <div
                  className="flex items-start gap-3 rounded-xl p-3.5 transition-colors"
                  style={{
                    background: n.read ? "rgba(255,255,255,.025)" : "rgba(255,255,255,.06)",
                    border: n.read
                      ? "1px solid rgba(255,255,255,.05)"
                      : "1px solid rgba(245,158,11,.15)",
                    opacity: n.read ? 0.7 : 1,
                  }}
                >
                  <span
                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px] text-[15px]"
                    style={{ background: ico.bg }}
                  >
                    {ico.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12.5px] font-semibold text-white/90">
                      {n.title}
                    </p>
                    {n.body && (
                      <p className="mt-0.5 line-clamp-2 text-[11px] text-white/55">
                        {n.body}
                      </p>
                    )}
                    <p className="mt-1 text-[10px] text-white/35">
                      {formatDistanceToNow(new Date(n.at), { addSuffix: true })}
                    </p>
                  </div>
                  {!n.read && (
                    <span
                      className="mt-1 h-2 w-2 flex-shrink-0 rounded-full"
                      style={{ background: ico.color }}
                    />
                  )}
                </div>
              );
              if (n.href) return <Link key={n.id} href={n.href}>{Inner}</Link>;
              return <div key={n.id}>{Inner}</div>;
            })}
          </div>
        )}
      </div>
    </div>
  );
}
