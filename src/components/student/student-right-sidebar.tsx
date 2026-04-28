"use client";

import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api/client";

type Classmate = {
  uid: string;
  displayName?: string;
  email?: string;
  classroomName?: string;
};

type LeaderboardRow = {
  uid: string;
  displayName?: string;
  email?: string;
  weekEarned: number;
};

type Announcement = {
  id: string;
  title: string;
  sub: string;
  dot: "red" | "green" | "amber" | "indigo";
};

type SocialResp = {
  classmates: Classmate[];
  leaderboard: LeaderboardRow[];
  announcements: Announcement[];
  me: { uid: string };
};

const DOT_COLORS: Record<Announcement["dot"], string> = {
  red: "#EF4444",
  green: "#4ADE80",
  amber: "#F59E0B",
  indigo: "#6366F1",
};

function avBg(uid: string) {
  // Hash uid → one of 6 indigo/purple shades so avatars don't all match
  const palette = [
    "linear-gradient(135deg,#6366F1,#8B5CF6)",
    "linear-gradient(135deg,#EC4899,#F97316)",
    "linear-gradient(135deg,#10B981,#14B8A6)",
    "linear-gradient(135deg,#F59E0B,#EF4444)",
    "linear-gradient(135deg,#06B6D4,#3B82F6)",
    "linear-gradient(135deg,#A855F7,#EC4899)",
  ];
  let h = 0;
  for (const c of uid) h = (h * 31 + c.charCodeAt(0)) | 0;
  return palette[Math.abs(h) % palette.length];
}

function initialsOf(name?: string, email?: string) {
  const s = name ?? email ?? "?";
  return s
    .split(/[\s@.]+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function StudentRightSidebar() {
  const q = useQuery<SocialResp>({
    queryKey: ["student", "social"],
    queryFn: () => api.get("/student/social") as unknown as Promise<SocialResp>,
    refetchInterval: 45_000,
  });

  const classmates = q.data?.classmates ?? [];
  const leaderboard = q.data?.leaderboard ?? [];
  const announcements = q.data?.announcements ?? [];
  const meUid = q.data?.me.uid;

  return (
    <aside
      className="flex w-[260px] flex-shrink-0 flex-col overflow-y-auto"
      style={{
        background: "#090718",
        borderLeft: "1px solid rgba(255,255,255,.06)",
      }}
    >
      <Section title="👥 Classmates">
        {classmates.length === 0 ? (
          <Empty>Join a class to see your classmates here.</Empty>
        ) : (
          <ul className="flex flex-col gap-2">
            {classmates.slice(0, 5).map((c) => (
              <li key={c.uid} className="flex items-center gap-2">
                <span
                  className="flex h-[26px] w-[26px] items-center justify-center rounded-full text-[8.5px] font-bold text-white"
                  style={{ background: avBg(c.uid) }}
                >
                  {initialsOf(c.displayName, c.email)}
                </span>
                <span className="flex-1 truncate text-[11px] font-medium text-white/70">
                  {c.displayName ?? c.email ?? "Classmate"}
                </span>
                <span
                  className="h-[7px] w-[7px] flex-shrink-0 rounded-full"
                  style={{ background: "rgba(255,255,255,.2)" }}
                  title="Offline"
                />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="🏆 Top This Week">
        {leaderboard.filter((r) => r.weekEarned > 0).length === 0 ? (
          <Empty>No BT earned yet this week.</Empty>
        ) : (
          <ol className="flex flex-col gap-2">
            {leaderboard.map((r, i) => {
              const isMe = r.uid === meUid;
              return (
                <li key={r.uid} className="flex items-center gap-2">
                  <span className="w-4 text-[10px] font-bold text-white/35">
                    {i + 1}
                  </span>
                  <span
                    className="flex h-[26px] w-[26px] items-center justify-center rounded-full text-[8.5px] font-bold text-white"
                    style={{ background: avBg(r.uid) }}
                  >
                    {initialsOf(r.displayName, r.email)}
                  </span>
                  <span className="flex-1 truncate text-[11px] font-medium text-white/70">
                    {(r.displayName ?? r.email ?? "Student")}
                    {isMe && <span className="ml-1 text-white/40">(you)</span>}
                  </span>
                  <span className="text-[10px] font-bold text-[#A5B4FC]">
                    {r.weekEarned} BT
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </Section>

      <Section title="📣 Announcements" last>
        {announcements.length === 0 ? (
          <Empty>No announcements yet.</Empty>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {announcements.map((a) => (
              <li key={a.id} className="flex items-start gap-2">
                <span
                  className="mt-1 h-[7px] w-[7px] flex-shrink-0 rounded-full"
                  style={{ background: DOT_COLORS[a.dot] }}
                />
                <div className="min-w-0">
                  <p className="line-clamp-2 text-[11px] font-semibold text-white/80">
                    {a.title}
                  </p>
                  <p className="mt-0.5 truncate text-[9.5px] text-white/35">{a.sub}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </aside>
  );
}

function Section({
  title,
  children,
  last,
}: {
  title: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <section
      className="p-4"
      style={
        last
          ? undefined
          : { borderBottom: "1px solid rgba(255,255,255,.05)" }
      }
    >
      <p
        className="mb-2.5 text-[10px] font-bold uppercase text-white/35"
        style={{ letterSpacing: "0.6px" }}
      >
        {title}
      </p>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] text-white/35">{children}</p>;
}
