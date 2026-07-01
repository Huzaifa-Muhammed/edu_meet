"use client";
export const dynamic = "force-dynamic";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Plus,
  Trash2,
  Radio,
  X,
  CalendarDays,
  Clock,
  Check,
  RefreshCw,
  CalendarOff,
} from "lucide-react";
import api from "@/lib/api/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { CreateClassForm } from "@/components/teacher/create-class-form";
import { AvailabilityEditor } from "@/components/teacher/availability-editor";
import { LeaveModal } from "@/components/teacher/leave-modal";
import { CoverRequestsPanel } from "@/components/teacher/cover-requests-panel";
import {
  MonthCalendar,
  type ScheduleMeeting,
} from "@/components/shared/month-calendar";
import type { AvailabilityBlock } from "@/shared/types/domain";

type PendingProposal = { weekStart: string; weekEnd: string; count: number } | null;

type ScheduleResp = {
  month: string;
  meetings: ScheduleMeeting[];
  availability: { teacherId: string; timezone?: string; blocks: AvailabilityBlock[] };
  pendingProposal: PendingProposal;
  leaveDates: string[];
};

type GenerateResp = {
  created: number;
  weekStart: string | null;
  weekEnd?: string;
  usedAi: boolean;
  reason: "ok" | "no-classrooms" | "already-scheduled";
};

function fmtDay(d: string) {
  return format(new Date(`${d}T00:00:00`), "MMM d");
}

export default function TeacherSchedulePage() {
  const router = useRouter();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [monthIdx0, setMonthIdx0] = useState(now.getMonth());
  const [tab, setTab] = useState<"calendar" | "availability">("calendar");
  const [newOpen, setNewOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [selected, setSelected] = useState<ScheduleMeeting | null>(null);

  const monthStr = `${year}-${String(monthIdx0 + 1).padStart(2, "0")}`;
  const monthLabel = format(new Date(year, monthIdx0, 1), "MMMM yyyy");

  const schedQ = useQuery<ScheduleResp>({
    queryKey: ["teacher", "schedule", monthStr],
    queryFn: () =>
      api.get(`/teacher/schedule?month=${monthStr}`) as unknown as Promise<ScheduleResp>,
    enabled: !!user,
  });

  const meetings = schedQ.data?.meetings ?? [];
  const pending = schedQ.data?.pendingProposal ?? null;
  const liveMeetings = meetings.filter((m) => m.status === "live");

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["teacher", "schedule"] });
    queryClient.invalidateQueries({ queryKey: ["teacher", "dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["meetings"] });
  };

  const generateMut = useMutation({
    mutationFn: (vars: { weekStart?: string }) =>
      api.post("/teacher/schedule/generate", vars) as Promise<GenerateResp>,
    onSuccess: (r) => {
      if (r.reason === "no-classrooms") {
        toast.error("Create a classroom first — the AI schedules your existing classes.");
        return;
      }
      if (r.reason === "already-scheduled") {
        toast.info("Your upcoming weeks are already scheduled.");
        return;
      }
      toast.success(
        `${r.usedAi ? "AI" : "Auto"} proposed ${r.created} class${
          r.created === 1 ? "" : "es"
        }${r.weekStart ? ` for week of ${fmtDay(r.weekStart)}` : ""}. Review & approve below.`,
      );
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const approveMut = useMutation({
    mutationFn: () =>
      api.post("/teacher/schedule/approve", {}) as Promise<{ approved: number; skipped: number }>,
    onSuccess: (r) => {
      toast.success(
        `Approved ${r.approved} class${r.approved === 1 ? "" : "es"} — now live on your dashboard and for students.${
          r.skipped ? ` ${r.skipped} skipped (clashed with another teacher).` : ""
        }`,
      );
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const discardMut = useMutation({
    mutationFn: () =>
      api.post("/teacher/schedule/discard", {}) as Promise<{ discarded: number }>,
    onSuccess: (r) => {
      toast.success(`Discarded ${r.discarded} proposed class${r.discarded === 1 ? "" : "es"}.`);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const clearMut = useMutation({
    mutationFn: () =>
      api.delete(`/teacher/schedule?month=${monthStr}`) as Promise<{ cleared: number }>,
    onSuccess: (r) => {
      toast.success(`Cleared ${r.cleared} scheduled class${r.cleared === 1 ? "" : "es"}.`);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveAvailMut = useMutation({
    mutationFn: (blocks: AvailabilityBlock[]) =>
      api.put("/teacher/availability", {
        blocks,
        timezone:
          typeof Intl !== "undefined"
            ? Intl.DateTimeFormat().resolvedOptions().timeZone
            : undefined,
      }) as Promise<unknown>,
    onSuccess: () => {
      toast.success("Availability saved.");
      queryClient.invalidateQueries({ queryKey: ["teacher", "schedule"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function shiftMonth(delta: number) {
    let m = monthIdx0 + delta;
    let y = year;
    if (m < 0) {
      m = 11;
      y -= 1;
    } else if (m > 11) {
      m = 0;
      y += 1;
    }
    setYear(y);
    setMonthIdx0(m);
  }

  function jumpToWeek(weekStart: string) {
    const d = new Date(`${weekStart}T00:00:00`);
    setYear(d.getFullYear());
    setMonthIdx0(d.getMonth());
  }

  const busy = generateMut.isPending || approveMut.isPending || discardMut.isPending;

  return (
    <div className="min-h-full bg-bg p-6">
      <div className="mx-auto max-w-5xl space-y-5">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => shiftMonth(-1)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-bd bg-surf text-t2 hover:bg-panel"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[140px] text-center text-sm font-bold text-t">
              {monthLabel}
            </span>
            <button
              onClick={() => shiftMonth(1)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-bd bg-surf text-t2 hover:bg-panel"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!pending && (
              <button
                onClick={() => generateMut.mutate({})}
                disabled={busy}
                className="flex items-center gap-1.5 rounded-lg bg-acc px-3 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                <Sparkles className="h-3.5 w-3.5" />
                {generateMut.isPending ? "Generating…" : "Generate with AI"}
              </button>
            )}
            <button
              onClick={() => {
                if (confirm(`Clear all AI-scheduled classes in ${monthLabel}?`))
                  clearMut.mutate();
              }}
              disabled={clearMut.isPending}
              className="flex items-center gap-1.5 rounded-lg border border-bd bg-surf px-3 py-2 text-xs font-semibold text-t2 hover:bg-panel disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear
            </button>
            <button
              onClick={() => setLeaveOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-bd bg-surf px-3 py-2 text-xs font-semibold text-t2 hover:bg-panel"
            >
              <CalendarOff className="h-3.5 w-3.5" />
              Leave
            </button>
            <button
              onClick={() => setNewOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-bd bg-surf px-3 py-2 text-xs font-semibold text-t2 hover:bg-panel"
            >
              <Plus className="h-3.5 w-3.5" />
              New Class
            </button>
          </div>
        </div>

        {/* AI proposal banner */}
        {pending && (
          <div
            className="rounded-2xl border p-4"
            style={{
              background: "var(--accbg)",
              borderColor: "var(--acc)",
            }}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <span
                  className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
                  style={{ background: "var(--acc)" }}
                >
                  <Sparkles className="h-4 w-4 text-white" />
                </span>
                <div>
                  <p className="text-sm font-bold text-t">
                    AI proposed {pending.count} class{pending.count === 1 ? "" : "es"} for the week of{" "}
                    {fmtDay(pending.weekStart)} – {fmtDay(pending.weekEnd)}
                  </p>
                  <p className="mt-0.5 text-xs text-t2">
                    Review the dashed classes below. Approving makes them visible on your dashboard
                    and to students enrolled in or interested in the subject.{" "}
                    <button
                      onClick={() => jumpToWeek(pending.weekStart)}
                      className="font-semibold text-acc underline"
                    >
                      View on calendar
                    </button>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => approveMut.mutate()}
                  disabled={busy}
                  className="flex items-center gap-1.5 rounded-lg bg-acc px-3 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                >
                  <Check className="h-3.5 w-3.5" />
                  {approveMut.isPending ? "Approving…" : "Approve"}
                </button>
                <button
                  onClick={() => generateMut.mutate({ weekStart: pending.weekStart })}
                  disabled={busy}
                  className="flex items-center gap-1.5 rounded-lg border border-bd bg-surf px-3 py-2 text-xs font-semibold text-t2 hover:bg-panel disabled:opacity-50"
                  title="Regenerate this week's proposal"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Regenerate
                </button>
                <button
                  onClick={() => discardMut.mutate()}
                  disabled={busy}
                  className="flex items-center gap-1.5 rounded-lg border border-bd bg-surf px-3 py-2 text-xs font-semibold text-t2 hover:bg-panel disabled:opacity-50"
                >
                  <X className="h-3.5 w-3.5" />
                  Discard
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Cover-request marketplace (substitute for a teacher on leave) */}
        <CoverRequestsPanel />

        {/* Tabs */}
        <div className="flex items-center gap-1 rounded-xl border border-bd bg-surf p-1">
          <TabBtn active={tab === "calendar"} onClick={() => setTab("calendar")}>
            <CalendarDays className="h-3.5 w-3.5" /> Calendar
          </TabBtn>
          <TabBtn active={tab === "availability"} onClick={() => setTab("availability")}>
            <Clock className="h-3.5 w-3.5" /> Availability
          </TabBtn>
        </div>

        {/* Live banner */}
        {liveMeetings.length > 0 && (
          <div className="space-y-2">
            {liveMeetings.map((m) => (
              <button
                key={m.id}
                onClick={() => router.push(`/teacher/classroom/${m.id}`)}
                className="flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left"
                style={{
                  background: "rgba(239,68,68,.08)",
                  borderColor: "rgba(239,68,68,.4)",
                }}
              >
                <Radio className="h-4 w-4 animate-pulse text-[#F87171]" />
                <span className="flex-1 text-sm font-semibold text-t">
                  {m.classroomName} is live now
                </span>
                <span className="text-xs font-semibold text-[#F87171]">Re-enter →</span>
              </button>
            ))}
          </div>
        )}

        {tab === "calendar" ? (
          <div className="rounded-2xl border border-bd bg-surf p-4">
            {schedQ.isLoading ? (
              <div className="h-80 animate-pulse rounded-xl bg-panel" />
            ) : (
              <>
                <MonthCalendar
                  year={year}
                  monthIdx0={monthIdx0}
                  meetings={meetings}
                  onSelect={(m) => setSelected(m)}
                  leaveDates={schedQ.data?.leaveDates}
                />
                {meetings.length === 0 && (
                  <div className="mt-4 rounded-xl border border-dashed border-bd bg-panel p-6 text-center">
                    <p className="text-sm font-semibold text-t">
                      Nothing scheduled for {monthLabel}
                    </p>
                    <p className="mx-auto mt-1 max-w-md text-xs text-t3">
                      The AI proposes a fresh week automatically, or hit{" "}
                      <span className="font-semibold text-t2">Generate with AI</span> — we’ll spread
                      your classes around your availability and detect each class’s subject.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-bd bg-surf p-4">
            {schedQ.isLoading ? (
              <div className="h-80 animate-pulse rounded-xl bg-panel" />
            ) : (
              <AvailabilityEditor
                initialBlocks={schedQ.data?.availability.blocks ?? []}
                saving={saveAvailMut.isPending}
                onSave={(blocks) => saveAvailMut.mutate(blocks)}
              />
            )}
          </div>
        )}
      </div>

      {selected && (
        <ClassDetailModal
          m={selected}
          onClose={() => setSelected(null)}
          onOpen={() => router.push(`/teacher/classroom/${selected.id}`)}
        />
      )}

      <CreateClassForm
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onCreated={(meeting) => router.push(`/teacher/classroom/${meeting.id}`)}
      />

      {leaveOpen && <LeaveModal onClose={() => setLeaveOpen(false)} />}
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
        active ? "bg-acc text-white" : "text-t2 hover:bg-panel"
      }`}
    >
      {children}
    </button>
  );
}

function ClassDetailModal({
  m,
  onClose,
  onOpen,
}: {
  m: ScheduleMeeting;
  onClose: () => void;
  onOpen: () => void;
}) {
  const dateLabel = m.scheduledDate
    ? format(new Date(`${m.scheduledDate}T00:00:00`), "EEEE, MMMM d")
    : "—";
  const isPast = m.status === "ended";
  const proposed = m.scheduleStatus === "proposed";
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,.55)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-bd bg-surf p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between">
          <div>
            <h3 className="text-base font-bold text-t">{m.classroomName}</h3>
            {m.subjectName && <p className="mt-0.5 text-xs text-t3">{m.subjectName}</p>}
          </div>
          <button onClick={onClose} className="text-t3 hover:text-t">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-2 rounded-xl border border-bd bg-panel p-3 text-xs">
          <Row label="When" value={dateLabel} />
          <Row label="Time" value={`${m.scheduledTime ?? "—"} · ${m.durationMin} min`} />
          {(m.grade != null || m.syllabus) && (
            <Row
              label="Curriculum"
              value={
                [m.grade != null ? `Grade ${m.grade}` : null, m.syllabus || null]
                  .filter(Boolean)
                  .join(" · ") || "—"
              }
            />
          )}
          <Row
            label="Status"
            value={
              m.status === "live"
                ? "Live now"
                : proposed
                  ? "Proposed (awaiting approval)"
                  : m.status
            }
            valueClass={m.status === "live" ? "text-[#F87171]" : "text-t2"}
          />
          {m.source === "ai" && <Row label="Source" value="AI-scheduled" />}
        </div>

        {proposed && (
          <p className="mt-3 text-[11px] text-t3">
            This class is part of an AI proposal. Approve it from the banner to publish it to your
            dashboard and students.
          </p>
        )}

        {!isPast && !proposed && (
          <button
            onClick={onOpen}
            className="mt-4 w-full rounded-lg bg-acc px-3 py-2.5 text-xs font-semibold text-white hover:opacity-90"
          >
            {m.status === "live" ? "Re-enter class →" : "Open / start class →"}
          </button>
        )}
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-t3">{label}</span>
      <span className={`font-semibold capitalize ${valueClass ?? "text-t"}`}>{value}</span>
    </div>
  );
}
