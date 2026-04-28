"use client";
export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { addDays, format, isSameDay, startOfWeek } from "date-fns";
import api from "@/lib/api/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { SubjectPicker } from "@/components/shared/subject-picker";
import { Modal } from "@/components/shared/modal";

type MeetingCard = {
  id: string;
  status: string;
  startedAt?: string;
  classroomId: string;
  teacherId: string;
  enrolled: boolean;
  classroom: { id: string; name: string; subjectName?: string; grade: number; code?: string };
  teacher: { displayName?: string } | null;
};

type LiveClassesResponse = { live: MeetingCard[]; upcoming: MeetingCard[] };

type StudentAssessment = {
  id: string;
  title: string;
  dueAt?: string;
  totalPoints: number;
  classroomName: string;
  submitted: boolean;
  submissionStatus: "submitted" | "graded" | null;
  finalScore: number | null;
};

type Wallet = { tokens: { balance: number; weekEarned: number; streakDays: number } };
type Progress = { overallPct: number; rank: number | null };
type Activity = {
  id: string;
  kind: "token" | "quiz" | "attendance";
  title: string;
  subtitle?: string;
  amount?: number;
  at: string;
};

function hasNoSubjects(s: unknown) {
  return !Array.isArray(s) || s.length === 0;
}

export default function StudentDashboardPage() {
  const { user, loading } = useCurrentUser();
  const qc = useQueryClient();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [askedOnce, setAskedOnce] = useState(false);

  useEffect(() => {
    if (loading || !user) return;
    const empty = hasNoSubjects(user.subjects);
    if (empty && !askedOnce) {
      setPickerOpen(true);
      setAskedOnce(true);
    } else if (!empty && pickerOpen) {
      setPickerOpen(false);
    }
  }, [loading, user, askedOnce, pickerOpen]);

  useEffect(() => {
    if (!user) return;
    api.post("/student/streak").catch(() => {});
  }, [user]);

  const liveQ = useQuery<LiveClassesResponse>({
    queryKey: ["student", "live-classes"],
    queryFn: () => api.get("/student/live-classes") as unknown as Promise<LiveClassesResponse>,
    enabled: !!user && !hasNoSubjects(user.subjects),
    refetchInterval: 15_000,
  });
  const assessmentsQ = useQuery<StudentAssessment[]>({
    queryKey: ["student", "assessments"],
    queryFn: () => api.get("/student/assessments") as unknown as Promise<StudentAssessment[]>,
    enabled: !!user,
  });
  const walletQ = useQuery<Wallet>({
    queryKey: ["student", "wallet"],
    queryFn: () => api.get("/student/wallet") as unknown as Promise<Wallet>,
    enabled: !!user,
  });
  const progressQ = useQuery<Progress>({
    queryKey: ["student", "progress"],
    queryFn: () => api.get("/student/progress") as unknown as Promise<Progress>,
    enabled: !!user,
  });
  const feedQ = useQuery<Activity[]>({
    queryKey: ["student", "activity"],
    queryFn: () => api.get("/student/activity") as unknown as Promise<Activity[]>,
    enabled: !!user,
  });
  const offersQ = useQuery<{ offers: unknown[]; redemptions: { offerId: string }[] }>({
    queryKey: ["student", "offers-count"],
    queryFn: () =>
      api.get("/student/offers") as unknown as Promise<{
        offers: unknown[];
        redemptions: { offerId: string }[];
      }>,
    enabled: !!user,
  });

  const enrollMut = useMutation({
    mutationFn: ({ classroomId, code }: { classroomId: string; code: string }) =>
      api.post(`/classrooms/${classroomId}/enroll`, { code }),
    onSuccess: () => {
      toast.success("Joined class!");
      qc.invalidateQueries({ queryKey: ["student", "live-classes"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const liveList = liveQ.data?.live ?? [];
  const upcomingList = liveQ.data?.upcoming ?? [];
  const balance = walletQ.data?.tokens.balance ?? 0;
  const weekEarned = walletQ.data?.tokens.weekEarned ?? 0;
  const streak = walletQ.data?.tokens.streakDays ?? 0;
  const overallPct = progressQ.data?.overallPct ?? 0;
  const newOffers = Math.max(
    0,
    (offersQ.data?.offers.length ?? 0) - (offersQ.data?.redemptions.length ?? 0),
  );
  const assessments = assessmentsQ.data ?? [];
  const graded = assessments.filter((a) => a.submissionStatus === "graded");
  const lastGraded = graded[0];

  // Hero cards derived from real data, fallbacks where needed
  const heroLive = liveList[0];
  const heroUpcoming = upcomingList[0];

  return (
    <div className="min-h-full bg-bg p-[22px]">
      <div className="flex flex-col gap-4">
        {/* Hero row */}
        <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
          <HeroCard
            tag="🔴 Live Now"
            title={heroLive?.classroom.name ?? "Nothing live right now"}
            sub={heroLive?.classroom.subjectName ?? "We'll notify you when a class starts"}
            meta={
              heroLive
                ? `${heroLive.teacher?.displayName ?? "Teacher"} · ${heroLive.classroom.subjectName ?? heroLive.classroom.name}`
                : "No class in session"
            }
            cta={
              heroLive
                ? {
                    label: "Join Class →",
                    href: heroLive.enrolled ? `/student/classroom/${heroLive.id}` : undefined,
                    onClick: !heroLive.enrolled
                      ? () => {
                          const code = heroLive.classroom.code ?? prompt("Enter class code:") ?? "";
                          if (code)
                            enrollMut.mutate({ classroomId: heroLive.classroomId, code });
                        }
                      : undefined,
                  }
                : undefined
            }
            gradient="linear-gradient(135deg,#1a0533,#3d1178,#6b21a8)"
            art="📐"
          />
          <HeroCard
            tag="📅 Next up"
            title={heroUpcoming?.classroom.name ?? "Nothing scheduled yet"}
            sub={heroUpcoming?.classroom.subjectName ?? "Keep checking back"}
            meta={
              heroUpcoming
                ? `${heroUpcoming.teacher?.displayName ?? "Teacher"}${
                    heroUpcoming.startedAt
                      ? ` · ${format(new Date(heroUpcoming.startedAt), "MMM d, h:mm a")}`
                      : ""
                  }`
                : "Nothing in your subjects"
            }
            cta={
              heroUpcoming
                ? { label: "Set Reminder →" }
                : undefined
            }
            gradient="linear-gradient(135deg,#0c2340,#1e3a6e,#1d4ed8)"
            art="⚗️"
          />
          <HeroCard
            tag={lastGraded ? "✅ Completed" : "📘 Recent work"}
            title={lastGraded?.title ?? "No graded work yet"}
            sub={lastGraded?.classroomName ?? "Finish an assessment to see feedback"}
            meta={
              lastGraded && lastGraded.totalPoints > 0
                ? `Score: ${Math.round(((lastGraded.finalScore ?? 0) / lastGraded.totalPoints) * 100)}%`
                : "Complete one to get started"
            }
            cta={
              lastGraded
                ? {
                    label: "View Feedback →",
                    href: `/student/assessments/${lastGraded.id}`,
                  }
                : undefined
            }
            gradient="linear-gradient(135deg,#0a2a1a,#15532a,#16a34a)"
            art="📚"
          />
        </div>

        {/* Stats row */}
        <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(5,1fr)" }}>
          <StatCard icon="🪙" value={balance} label="Brain Tokens" trend={weekEarned > 0 ? `+${weekEarned} this week` : undefined} tone="up" />
          <StatCard icon="🔥" value={streak} label="Day Streak" trend={streak > 1 ? "Personal best!" : "First day"} tone="up" />
          <StatCard icon="📊" value={`${overallPct}%`} label="Overall Score" trend={progressQ.data?.rank ? `Rank #${progressQ.data.rank}` : undefined} tone="up" />
          <StatCard icon="📅" value={liveList.length + upcomingList.length} label="This Week" trend="Classes scheduled" />
          <StatCard icon="🎁" value={newOffers} label="New Offers" trend="Tap to view" tone="new" href="/student/offers" />
        </div>

        {/* Activity + Quick actions */}
        <div className="grid gap-3.5" style={{ gridTemplateColumns: "1fr 260px" }}>
          <Card>
            <SectionHdr>📋 Recent Activity</SectionHdr>
            {feedQ.data && feedQ.data.length > 0 ? (
              <div className="mt-3 flex flex-col gap-2.5">
                {feedQ.data.slice(0, 6).map((f) => (
                  <ActivityRow key={f.id} item={f} />
                ))}
              </div>
            ) : (
              <p className="mt-3 text-[11px] text-white/40">
                No activity yet. Join a class or complete a quiz to start earning.
              </p>
            )}
          </Card>
          <Card>
            <SectionHdr>⚡ Quick Actions</SectionHdr>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <QuickAction emoji="📝" label="Assessments" href="/student/assessments" />
              <QuickAction emoji="🪙" label="Wallet" href="/student/wallet" />
              <QuickAction emoji="🎁" label="Offers" href="/student/offers" />
              <QuickAction emoji="📈" label="Progress" href="/student/progress" />
              <QuickAction emoji="🆘" label="Support" href="/student/support" />
              <QuickAction emoji="🎮" label="Gaming" href="/student/gaming" />
            </div>
          </Card>
        </div>

        {/* Schedule */}
        <ScheduleSection
          live={liveList}
          upcoming={upcomingList}
          onJoin={(m) => {
            if (m.enrolled) return;
            const code = m.classroom.code ?? prompt("Enter class code:") ?? "";
            if (code) enrollMut.mutate({ classroomId: m.classroomId, code });
          }}
        />
      </div>

      <Modal
        open={pickerOpen}
        onClose={() => {
          if (!hasNoSubjects(user?.subjects)) setPickerOpen(false);
        }}
        title="Pick your subjects"
        description="We'll show you live classes and recommendations in these subjects."
        size="lg"
      >
        <SubjectPicker
          selected={user?.subjects ?? []}
          onSave={async (subjects) => {
            await api.patch("/users/me/subjects", { subjects });
            setPickerOpen(false);
          }}
          invalidateUserQuery
        />
      </Modal>
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
  cta?: { label: string; href?: string; onClick?: () => void };
  gradient: string;
  art: string;
}) {
  const Button = cta ? (
    cta.href ? (
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
    ) : (
      <button
        onClick={cta.onClick}
        className="mt-auto inline-flex w-max rounded-full px-3.5 py-[7px] text-[11px] font-semibold text-white"
        style={{
          background: "rgba(255,255,255,.12)",
          border: "1px solid rgba(255,255,255,.25)",
        }}
      >
        {cta.label}
      </button>
    )
  ) : null;

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
      {Button}
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
  tone?: "up" | "new";
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
              tone === "up" ? "#4ADE80" : tone === "new" ? "#F59E0B" : "rgba(255,255,255,.3)",
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

function ActivityRow({ item }: { item: Activity }) {
  const positive = (item.amount ?? 0) > 0;
  const iconFor = () => {
    if (item.kind === "quiz") return { bg: "rgba(74,222,128,.15)", char: "📝" };
    if (item.kind === "attendance") return { bg: "rgba(148,163,184,.1)", char: "✓" };
    if (positive) return { bg: "rgba(99,102,241,.15)", char: "🪙" };
    return { bg: "rgba(148,163,184,.1)", char: "🎁" };
  };
  const { bg, char } = iconFor();
  return (
    <div className="flex items-center gap-2.5">
      <span
        className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-[8px] text-[13px]"
        style={{ background: bg }}
      >
        {char}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11.5px] font-semibold text-white/85">
          {item.title}
        </p>
        {item.subtitle && (
          <p className="mt-px truncate text-[10px] text-white/35">{item.subtitle}</p>
        )}
      </div>
      {typeof item.amount === "number" && (
        <span
          className="text-[10.5px] font-bold"
          style={{ color: positive ? "#6366F1" : "#F87171" }}
        >
          {positive ? "+" : ""}
          {item.amount} BT
        </span>
      )}
    </div>
  );
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
      className="flex flex-col items-center gap-1 rounded-[11px] px-2 py-2.5 text-[10.5px] font-semibold text-white/60 transition-colors hover:text-[#A5B4FC]"
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

/* ─────────── schedule ─────────── */

function ScheduleSection({
  live,
  upcoming,
  onJoin,
}: {
  live: MeetingCard[];
  upcoming: MeetingCard[];
  onJoin: (m: MeetingCard) => void;
}) {
  // Build week strip — Mon → Sun of current week
  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const days = useMemo(() => {
    const arr: { date: Date; dayNum: string; dayName: string; hasClass: boolean }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = addDays(weekStart, i);
      const hasClass = [...live, ...upcoming].some(
        (m) => m.startedAt && isSameDay(new Date(m.startedAt), d),
      );
      arr.push({
        date: d,
        dayNum: format(d, "d"),
        dayName: format(d, "EEE").toUpperCase(),
        hasClass,
      });
    }
    return arr;
  }, [weekStart, live, upcoming]);

  const todaysClasses = [...live, ...upcoming].filter(
    (m) => m.startedAt && isSameDay(new Date(m.startedAt), today),
  );

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <SectionHdr>📅 My Schedule</SectionHdr>
        <span className="text-[10px] text-white/35">{format(today, "EEEE, MMM d")}</span>
      </div>

      <div className="mb-4 flex gap-1.5">
        {days.map((d) => {
          const isToday = isSameDay(d.date, today);
          return (
            <div
              key={d.dayName}
              className="flex-1 rounded-[11px] px-1 py-2 text-center"
              style={{
                background: isToday ? "rgba(99,102,241,.2)" : "rgba(255,255,255,.04)",
                border: isToday
                  ? "1px solid rgba(99,102,241,.4)"
                  : d.hasClass
                    ? "1px solid rgba(74,222,128,.3)"
                    : "1px solid rgba(255,255,255,.07)",
              }}
            >
              <p
                className="text-[9px] font-semibold uppercase text-white/40"
                style={{ letterSpacing: "0.3px" }}
              >
                {d.dayName}
              </p>
              <p className="mt-1 text-[15px] font-extrabold text-white">{d.dayNum}</p>
              {d.hasClass && (
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
              {todaysClasses.map((m) => (
                <ClassRow key={m.id} meeting={m} onJoin={() => onJoin(m)} />
              ))}
            </div>
          ) : (
            <p className="mt-3 text-[11px] text-white/40">
              No classes today. Check back tomorrow.
            </p>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <SectionHdr>Upcoming</SectionHdr>
            <span className="text-[10px] text-white/35">{upcoming.length}</span>
          </div>
          {upcoming.length > 0 ? (
            <div className="mt-3 flex flex-col gap-2">
              {upcoming.slice(0, 4).map((m) => (
                <ClassRow key={m.id} meeting={m} onJoin={() => onJoin(m)} />
              ))}
            </div>
          ) : (
            <p className="mt-3 text-[11px] text-white/40">
              No upcoming classes scheduled.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}

function ClassRow({
  meeting,
  onJoin,
}: {
  meeting: MeetingCard;
  onJoin: () => void;
}) {
  const isLive = meeting.status === "live";
  const timeLabel = meeting.startedAt ? format(new Date(meeting.startedAt), "HH:mm") : "—";
  return (
    <div
      className="flex items-center gap-3 rounded-[12px] px-3.5 py-3"
      style={{
        background: isLive ? "rgba(239,68,68,.05)" : "rgba(255,255,255,.04)",
        border: isLive ? "1px solid rgba(239,68,68,.3)" : "1px solid rgba(255,255,255,.07)",
      }}
    >
      <span className="font-mono text-[10.5px] font-bold text-white/50">
        {timeLabel}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-[12px] font-semibold text-white">
            {meeting.classroom.name}
          </p>
          {meeting.classroom.subjectName && (
            <span
              className="flex-shrink-0 rounded-full px-1.5 py-px text-[8.5px] font-bold uppercase"
              style={{
                background: "rgba(99,102,241,.15)",
                color: "#A5B4FC",
                letterSpacing: "0.3px",
              }}
            >
              {meeting.classroom.subjectName}
            </span>
          )}
        </div>
        <p className="truncate text-[10px] text-white/40">
          {meeting.teacher?.displayName ?? "Teacher"}
          {isLive && " · Live now"}
        </p>
      </div>
      {isLive && meeting.enrolled ? (
        <Link
          href={`/student/classroom/${meeting.id}`}
          className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase"
          style={{ background: "rgba(239,68,68,.2)", color: "#F87171" }}
        >
          Live
        </Link>
      ) : isLive ? (
        <button
          onClick={onJoin}
          className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase"
          style={{ background: "rgba(239,68,68,.2)", color: "#F87171" }}
        >
          Join
        </button>
      ) : (
        <span
          className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase"
          style={{ background: "rgba(255,255,255,.08)", color: "rgba(255,255,255,.45)" }}
        >
          Soon
        </span>
      )}
    </div>
  );
}
