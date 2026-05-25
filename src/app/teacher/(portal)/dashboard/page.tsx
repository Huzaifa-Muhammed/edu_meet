"use client";
export const dynamic = "force-dynamic";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, addDays, isSameDay, startOfWeek } from "date-fns";
import api from "@/lib/api/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { CreateAssessmentForm } from "@/components/teacher/create-assessment-form";

type ActivityItem = {
  id: string;
  kind: "submission" | "question" | "rejoin";
  title: string;
  subtitle: string;
  at: string;
  href?: string;
};
type DashboardResp = {
  liveNow: {
    id: string;
    classroomId: string;
    classroomName: string;
    startedAt?: string;
    participantCount: number;
  } | null;
  nextUp: {
    id: string;
    classroomId: string;
    classroomName: string;
    startedAt?: string;
  } | null;
  stats: {
    todayClasses: number;
    totalStudents: number;
    pendingGrades: number;
    openQuestions: number;
    avgScorePct: number | null;
  };
  schedule: Array<{
    date: string;
    classes: Array<{
      id: string;
      classroomName: string;
      startedAt?: string;
      status: string;
    }>;
  }>;
  activity: ActivityItem[];
};

export default function TeacherDashboardPage() {
  const { user } = useCurrentUser();
  const [assessmentCtx, setAssessmentCtx] = useState<
    { classroomId: string; classroomName?: string } | null
  >(null);

  const dashQ = useQuery<DashboardResp>({
    queryKey: ["teacher", "dashboard"],
    queryFn: () =>
      api.get("/teacher/dashboard") as unknown as Promise<DashboardResp>,
    enabled: !!user,
    refetchInterval: 30_000,
  });

  const d = dashQ.data;
  const firstName = user?.displayName?.split(" ")[0] ?? "Teacher";

  return (
    <div className="min-h-full bg-bg p-[22px]">
      <div className="flex flex-col gap-4">
        {/* Hero row */}
        <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
          <HeroCard
            tag="🔴 Live now"
            title={d?.liveNow?.classroomName ?? "Nothing live"}
            sub={
              d?.liveNow
                ? `${d.liveNow.participantCount} student${
                    d.liveNow.participantCount === 1 ? "" : "s"
                  } joined`
                : "Start a class to go live"
            }
            meta={
              d?.liveNow?.startedAt
                ? `Started ${format(new Date(d.liveNow.startedAt), "h:mm a")}`
                : "No class in session"
            }
            cta={
              d?.liveNow
                ? { label: "Re-enter →", href: `/teacher/classroom/${d.liveNow.id}` }
                : { label: "Create class →", href: "/teacher/classes" }
            }
            gradient="linear-gradient(135deg,#3d1a08,#7c2d12,#c2410c)"
            art="🎤"
          />
          <HeroCard
            tag="📅 Next up"
            title={d?.nextUp?.classroomName ?? "Nothing scheduled"}
            sub={
              d?.nextUp?.startedAt
                ? format(new Date(d.nextUp.startedAt), "EEE, MMM d · h:mm a")
                : "Open Classes to plan one"
            }
            meta={d?.nextUp ? "Click to start when ready" : "—"}
            cta={
              d?.nextUp
                ? { label: "Start class →", href: `/teacher/classroom/${d.nextUp.id}` }
                : { label: "Schedule →", href: "/teacher/classes" }
            }
            gradient="linear-gradient(135deg,#0c2340,#1e3a6e,#1d4ed8)"
            art="📅"
          />
          <HeroCard
            tag="✍️ Grading"
            title={
              d?.stats.pendingGrades
                ? `${d.stats.pendingGrades} awaiting your review`
                : "All caught up"
            }
            sub="Short-answer submissions queue up here"
            meta={
              d?.stats.avgScorePct != null
                ? `Avg class score · ${d.stats.avgScorePct}%`
                : "—"
            }
            cta={{ label: "Open queue →", href: "/teacher/grading" }}
            gradient="linear-gradient(135deg,#0a2a1a,#15532a,#16a34a)"
            art="📝"
          />
        </div>

        {/* Stats row */}
        <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(5,1fr)" }}>
          <StatCard
            icon="📅"
            value={d?.stats.todayClasses ?? 0}
            label="Today's classes"
            trend="On your schedule"
          />
          <StatCard
            icon="👥"
            value={d?.stats.totalStudents ?? 0}
            label="Total students"
            trend="Across all classes"
            href="/teacher/students"
          />
          <StatCard
            icon="✍️"
            value={d?.stats.pendingGrades ?? 0}
            label="Pending grades"
            trend={d?.stats.pendingGrades ? "Needs attention" : "All graded"}
            tone={d?.stats.pendingGrades ? "alert" : "up"}
            href="/teacher/grading"
          />
          <StatCard
            icon="❓"
            value={d?.stats.openQuestions ?? 0}
            label="Open questions"
            trend="Student Q&A"
            tone={d?.stats.openQuestions ? "alert" : undefined}
          />
          <StatCard
            icon="📊"
            value={d?.stats.avgScorePct != null ? `${d.stats.avgScorePct}%` : "—"}
            label="Avg score"
            trend="Across graded work"
            href="/teacher/reports"
            tone="up"
          />
        </div>

        {/* Activity + Quick actions */}
        <div className="grid gap-3.5" style={{ gridTemplateColumns: "1fr 260px" }}>
          <Card>
            <SectionHdr>📋 Recent activity</SectionHdr>
            {!d?.activity.length ? (
              <p className="mt-3 text-[11px] text-white/40">
                Nothing yet — activity from your classes, submissions and student
                questions will show here.
              </p>
            ) : (
              <div className="mt-3 flex flex-col gap-2.5">
                {d.activity.slice(0, 6).map((a) => (
                  <ActivityRow key={a.id} item={a} />
                ))}
              </div>
            )}
          </Card>
          <Card>
            <SectionHdr>⚡ Quick actions</SectionHdr>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <QuickAction emoji="🎤" label="New class" href="/teacher/classes" />
              <QuickAction emoji="✍️" label="Grade" href="/teacher/grading" />
              <QuickAction emoji="📋" label="Assessments" href="/teacher/assessments" />
              <QuickAction emoji="👥" label="Students" href="/teacher/students" />
              <QuickAction emoji="📁" label="Library" href="/teacher/library" />
              <QuickAction emoji="📝" label="Templates" href="/teacher/templates" />
            </div>
          </Card>
        </div>

        {/* Schedule */}
        <ScheduleSection schedule={d?.schedule ?? []} firstName={firstName} />
      </div>

      <CreateAssessmentForm
        open={!!assessmentCtx}
        onClose={() => setAssessmentCtx(null)}
        classroomId={assessmentCtx?.classroomId ?? null}
        classroomName={assessmentCtx?.classroomName}
      />
    </div>
  );
}

/* ─────────── primitives ─────────── */

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl p-4"
      style={{
        background: "rgba(255,255,255,.03)",
        border: "1px solid rgba(255,255,255,.06)",
      }}
    >
      {children}
    </div>
  );
}

function SectionHdr({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-[12px] font-bold uppercase text-white/50"
      style={{ letterSpacing: "0.6px" }}
    >
      {children}
    </p>
  );
}

function HeroCard({
  tag,
  title,
  sub,
  meta,
  cta,
  gradient,
  art,
}: {
  tag: string;
  title: string;
  sub: string;
  meta: string;
  cta?: { label: string; href: string };
  gradient: string;
  art: string;
}) {
  return (
    <div
      className="relative flex min-h-[160px] flex-col gap-1.5 overflow-hidden rounded-[18px] p-[18px]"
      style={{ background: gradient, border: "1px solid rgba(255,255,255,.08)" }}
    >
      <span
        className="w-fit rounded-full px-[9px] py-0.5 text-[9.5px] font-bold text-white/70"
        style={{ background: "rgba(255,255,255,.1)" }}
      >
        {tag}
      </span>
      <p
        className="mt-1 text-[16px] font-extrabold text-white"
        style={{ letterSpacing: "-0.3px" }}
      >
        {title}
      </p>
      <p className="text-[12px] text-white/60">{sub}</p>
      <p className="text-[10.5px] text-white/40">{meta}</p>
      {cta && (
        <Link
          href={cta.href}
          className="mt-auto inline-flex w-max rounded-full px-3.5 py-[7px] text-[11px] font-semibold text-white"
          style={{
            background: "rgba(255,255,255,.12)",
            border: "1px solid rgba(255,255,255,.25)",
          }}
        >
          {cta.label}
        </Link>
      )}
      <span
        className="pointer-events-none absolute right-3.5 top-3.5 text-[40px]"
        style={{ opacity: 0.25 }}
      >
        {art}
      </span>
    </div>
  );
}

function StatCard({
  icon,
  value,
  label,
  trend,
  tone,
  href,
}: {
  icon: string;
  value: string | number;
  label: string;
  trend?: string;
  tone?: "up" | "alert";
  href?: string;
}) {
  const body = (
    <div
      className="rounded-[14px] px-3 py-3.5 text-center"
      style={{
        background: "rgba(255,255,255,.04)",
        border: "1px solid rgba(255,255,255,.07)",
      }}
    >
      <div className="mb-1.5 text-[20px]">{icon}</div>
      <p
        className="text-[22px] font-extrabold text-white"
        style={{ letterSpacing: "-0.5px" }}
      >
        {value}
      </p>
      <p className="mt-0.5 text-[10px] text-white/45">{label}</p>
      {trend && (
        <p
          className="mt-1 text-[9.5px]"
          style={{
            color:
              tone === "up"
                ? "#4ADE80"
                : tone === "alert"
                  ? "#FCD34D"
                  : "rgba(255,255,255,.3)",
          }}
        >
          {trend}
        </p>
      )}
    </div>
  );
  if (href) return <Link href={href}>{body}</Link>;
  return body;
}

function ActivityRow({ item }: { item: ActivityItem }) {
  const iconFor = () => {
    if (item.kind === "question") return { bg: "rgba(99,102,241,.15)", char: "❓" };
    if (item.kind === "rejoin") return { bg: "rgba(245,158,11,.15)", char: "🔁" };
    return { bg: "rgba(74,222,128,.15)", char: "📝" };
  };
  const { bg, char } = iconFor();
  const at = item.at ? format(new Date(item.at), "MMM d, h:mm a") : "";
  const body = (
    <div className="flex items-center gap-2.5">
      <span
        className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-[8px] text-[13px]"
        style={{ background: bg }}
      >
        {char}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11.5px] font-semibold text-white/85">{item.title}</p>
        <p className="mt-px truncate text-[10px] text-white/35">
          {item.subtitle} {at && `· ${at}`}
        </p>
      </div>
    </div>
  );
  if (item.href) return <Link href={item.href}>{body}</Link>;
  return body;
}

function QuickAction({
  emoji,
  label,
  href,
}: {
  emoji: string;
  label: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-1 rounded-[11px] px-2 py-2.5 text-[10.5px] font-semibold text-white/60 transition-colors hover:text-[#FCD34D]"
      style={{
        background: "rgba(255,255,255,.05)",
        border: "1px solid rgba(255,255,255,.08)",
      }}
    >
      <span className="text-[18px]">{emoji}</span>
      {label}
    </Link>
  );
}

function ScheduleSection({
  schedule,
  firstName,
}: {
  schedule: DashboardResp["schedule"];
  firstName: string;
}) {
  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });

  const todaysClasses =
    schedule.find((s) => s.date === today.toISOString().slice(0, 10))?.classes ?? [];

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <SectionHdr>📅 Your week, {firstName}</SectionHdr>
        <span className="text-[10px] text-white/35">{format(today, "EEEE, MMM d")}</span>
      </div>

      <div className="mb-4 flex gap-1.5">
        {Array.from({ length: 7 }).map((_, i) => {
          const d = addDays(weekStart, i);
          const isoDate = d.toISOString().slice(0, 10);
          const dayClasses =
            schedule.find((s) => s.date === isoDate)?.classes ?? [];
          const isToday = isSameDay(d, today);
          return (
            <div
              key={isoDate}
              className="flex-1 rounded-[11px] px-1 py-2 text-center"
              style={{
                background: isToday ? "rgba(245,158,11,.18)" : "rgba(255,255,255,.04)",
                border: isToday
                  ? "1px solid rgba(245,158,11,.4)"
                  : dayClasses.length > 0
                    ? "1px solid rgba(74,222,128,.3)"
                    : "1px solid rgba(255,255,255,.07)",
              }}
            >
              <p
                className="text-[9px] font-semibold uppercase text-white/40"
                style={{ letterSpacing: "0.3px" }}
              >
                {format(d, "EEE")}
              </p>
              <p className="mt-1 text-[15px] font-extrabold text-white">
                {format(d, "d")}
              </p>
              {dayClasses.length > 0 && (
                <span
                  className="mx-auto mt-1 block h-[5px] w-[5px] rounded-full"
                  style={{ background: "rgba(74,222,128,.7)" }}
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="grid gap-3.5" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <Card>
          <div className="flex items-center justify-between">
            <SectionHdr>Today</SectionHdr>
            <span className="text-[10px] text-white/35">{todaysClasses.length} classes</span>
          </div>
          {todaysClasses.length > 0 ? (
            <div className="mt-3 flex flex-col gap-2">
              {todaysClasses.map((c) => (
                <ClassRow key={c.id} cls={c} />
              ))}
            </div>
          ) : (
            <p className="mt-3 text-[11px] text-white/40">
              No classes today. Take a breath.
            </p>
          )}
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <SectionHdr>Rest of week</SectionHdr>
          </div>
          {schedule.slice(1).flatMap((s) => s.classes).length === 0 ? (
            <p className="mt-3 text-[11px] text-white/40">
              Nothing scheduled for the rest of this week.
            </p>
          ) : (
            <div className="mt-3 flex flex-col gap-2">
              {schedule
                .slice(1)
                .flatMap((s) => s.classes)
                .slice(0, 4)
                .map((c) => (
                  <ClassRow key={c.id} cls={c} />
                ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function ClassRow({
  cls,
}: {
  cls: { id: string; classroomName: string; startedAt?: string; status: string };
}) {
  const isLive = cls.status === "live";
  const timeLabel = cls.startedAt ? format(new Date(cls.startedAt), "HH:mm") : "—";
  return (
    <Link
      href={`/teacher/classroom/${cls.id}`}
      className="flex items-center gap-3 rounded-[12px] px-3.5 py-3"
      style={{
        background: isLive ? "rgba(239,68,68,.05)" : "rgba(255,255,255,.04)",
        border: isLive
          ? "1px solid rgba(239,68,68,.3)"
          : "1px solid rgba(255,255,255,.07)",
      }}
    >
      <span className="font-mono text-[10.5px] font-bold text-white/50">{timeLabel}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12px] font-semibold text-white">{cls.classroomName}</p>
        <p className="truncate text-[10px] text-white/40">
          {isLive ? "Live now" : cls.status}
        </p>
      </div>
      <span
        className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase"
        style={{
          background: isLive ? "rgba(239,68,68,.2)" : "rgba(245,158,11,.18)",
          color: isLive ? "#F87171" : "#FCD34D",
        }}
      >
        {isLive ? "Live" : "Open"}
      </span>
    </Link>
  );
}
