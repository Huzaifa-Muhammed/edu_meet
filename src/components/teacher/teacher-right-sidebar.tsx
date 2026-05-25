"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import api from "@/lib/api/client";

type DashboardResp = {
  liveNow: {
    id: string;
    classroomName: string;
    startedAt?: string;
    participantCount: number;
  } | null;
  schedule: Array<{
    date: string;
    classes: Array<{
      id: string;
      classroomName: string;
      startedAt?: string;
      status: string;
    }>;
  }>;
  activity: Array<{
    id: string;
    kind: "submission" | "question" | "rejoin";
    title: string;
    subtitle: string;
    at: string;
    href?: string;
  }>;
};

type ReportRow = {
  uid: string;
  displayName?: string;
  email?: string;
  avgScorePct: number | null;
};

const DOT_COLORS: Record<string, string> = {
  question: "#6366F1",
  submission: "#4ADE80",
  rejoin: "#F59E0B",
};

function avBg(uid: string) {
  const palette = [
    "linear-gradient(135deg,#F59E0B,#D97706)",
    "linear-gradient(135deg,#EC4899,#F97316)",
    "linear-gradient(135deg,#10B981,#14B8A6)",
    "linear-gradient(135deg,#6366F1,#8B5CF6)",
    "linear-gradient(135deg,#06B6D4,#3B82F6)",
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

export function TeacherRightSidebar() {
  const dashQ = useQuery<DashboardResp>({
    queryKey: ["teacher", "dashboard"],
    queryFn: () =>
      api.get("/teacher/dashboard") as unknown as Promise<DashboardResp>,
    refetchInterval: 30_000,
  });

  const reportsQ = useQuery<ReportRow[]>({
    queryKey: ["teacher", "reports"],
    queryFn: () =>
      api.get("/teacher/reports") as unknown as Promise<ReportRow[]>,
    refetchInterval: 60_000,
  });

  const todayDate = new Date().toISOString().slice(0, 10);
  const todaysClasses =
    dashQ.data?.schedule.find((s) => s.date === todayDate)?.classes ?? [];

  const topPerformers = (reportsQ.data ?? [])
    .filter((r) => r.avgScorePct != null)
    .slice(0, 5);

  const recent = dashQ.data?.activity.slice(0, 5) ?? [];

  return (
    <aside
      className="flex w-[260px] flex-shrink-0 flex-col overflow-y-auto"
      style={{
        background: "var(--cp)",
        borderLeft: "1px solid rgba(255,255,255,.06)",
      }}
    >
      <Section title="🎤 Today's classes">
        {dashQ.data?.liveNow && (
          <Link
            href={`/teacher/classroom/${dashQ.data.liveNow.id}`}
            className="mb-2 flex items-center gap-2 rounded-[10px] px-2.5 py-2"
            style={{
              background: "rgba(239,68,68,.1)",
              border: "1px solid rgba(239,68,68,.3)",
            }}
          >
            <span className="h-2 w-2 animate-pulse rounded-full bg-[#F87171]" />
            <span className="flex-1 truncate text-[11px] font-semibold text-white">
              {dashQ.data.liveNow.classroomName}
            </span>
            <span className="text-[9.5px] font-bold uppercase text-[#F87171]">
              Live
            </span>
          </Link>
        )}
        {todaysClasses.length === 0 ? (
          <Empty>No classes scheduled today.</Empty>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {todaysClasses.slice(0, 4).map((c) => (
              <li key={c.id}>
                <Link
                  href={`/teacher/classroom/${c.id}`}
                  className="flex items-center gap-2"
                >
                  <span className="font-mono text-[9.5px] font-bold text-white/50">
                    {c.startedAt ? format(new Date(c.startedAt), "HH:mm") : "—"}
                  </span>
                  <span className="flex-1 truncate text-[11px] font-medium text-white/70">
                    {c.classroomName}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="🏆 Top performers">
        {topPerformers.length === 0 ? (
          <Empty>No graded scores yet.</Empty>
        ) : (
          <ol className="flex flex-col gap-2">
            {topPerformers.map((r, i) => (
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
                  {r.displayName ?? r.email ?? "Student"}
                </span>
                <span className="text-[10px] font-bold text-[#FCD34D]">
                  {r.avgScorePct}%
                </span>
              </li>
            ))}
          </ol>
        )}
      </Section>

      <Section title="🔔 Recent activity" last>
        {recent.length === 0 ? (
          <Empty>Nothing yet — quiet day.</Empty>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {recent.map((a) => (
              <li key={a.id} className="flex items-start gap-2">
                <span
                  className="mt-1 h-[7px] w-[7px] flex-shrink-0 rounded-full"
                  style={{ background: DOT_COLORS[a.kind] }}
                />
                <div className="min-w-0">
                  <p className="line-clamp-2 text-[11px] font-semibold text-white/80">
                    {a.title}
                  </p>
                  <p className="mt-0.5 truncate text-[9.5px] text-white/35">
                    {a.subtitle}
                  </p>
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
      style={last ? undefined : { borderBottom: "1px solid rgba(255,255,255,.05)" }}
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
