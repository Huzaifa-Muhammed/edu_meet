"use client";

import { useMemo } from "react";

export type ScheduleMeeting = {
  id: string;
  classroomId: string;
  classroomName: string;
  subjectName: string;
  status: string; // scheduled | live | ended
  scheduleStatus?: string; // proposed | approved
  scheduledDate?: string; // YYYY-MM-DD
  scheduledTime?: string; // HH:MM
  durationMin: number;
  syllabus?: string; // exam board
  grade?: number;
  source?: string;
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Monday = 0 … Sunday = 6 for a "YYYY-MM-DD" (anchored at UTC midnight). */
function dowMon0(dateStr: string): number {
  const d = new Date(`${dateStr}T00:00:00Z`).getUTCDay();
  return (d + 6) % 7;
}

function localTodayStr(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(
    n.getDate(),
  ).padStart(2, "0")}`;
}

function statusAccent(status: string): string {
  if (status === "live") return "#EF4444";
  if (status === "ended") return "rgba(148,163,184,.85)";
  return "var(--acc)";
}

export function MonthCalendar({
  year,
  monthIdx0,
  meetings,
  onSelect,
  maxChips = 3,
  leaveDates,
}: {
  year: number;
  monthIdx0: number;
  meetings: ScheduleMeeting[];
  onSelect?: (m: ScheduleMeeting) => void;
  maxChips?: number;
  leaveDates?: string[];
}) {
  const todayStr = localTodayStr();
  const leaveSet = useMemo(() => new Set(leaveDates ?? []), [leaveDates]);

  const { cells, byDate } = useMemo(() => {
    const mm = String(monthIdx0 + 1).padStart(2, "0");
    const daysInMonth = new Date(Date.UTC(year, monthIdx0 + 1, 0)).getUTCDate();
    const firstStr = `${year}-${mm}-01`;
    const lead = dowMon0(firstStr);

    const byDate = new Map<string, ScheduleMeeting[]>();
    for (const m of meetings) {
      if (!m.scheduledDate) continue;
      const arr = byDate.get(m.scheduledDate) ?? [];
      arr.push(m);
      byDate.set(m.scheduledDate, arr);
    }
    for (const arr of byDate.values())
      arr.sort((a, b) => (a.scheduledTime ?? "").localeCompare(b.scheduledTime ?? ""));

    const cells: (string | null)[] = [];
    for (let i = 0; i < lead; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++)
      cells.push(`${year}-${mm}-${String(d).padStart(2, "0")}`);
    while (cells.length % 7 !== 0) cells.push(null);

    return { cells, byDate };
  }, [year, monthIdx0, meetings]);

  return (
    <div className="select-none">
      <div className="mb-1.5 grid grid-cols-7 gap-1.5">
        {WEEKDAYS.map((w) => (
          <div
            key={w}
            className="text-center text-[10px] font-semibold uppercase tracking-wide text-t3"
          >
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((date, i) => {
          if (!date) return <div key={`b-${i}`} className="min-h-[88px]" />;
          const day = Number(date.slice(8, 10));
          const isToday = date === todayStr;
          const isPast = date < todayStr;
          const onLeave = leaveSet.has(date);
          const dayClasses = byDate.get(date) ?? [];
          return (
            <div
              key={date}
              className="flex min-h-[88px] flex-col gap-1 rounded-xl border p-1.5 transition-colors"
              style={{
                background: onLeave
                  ? "rgba(239,68,68,.12)"
                  : isToday
                    ? "var(--accbg)"
                    : "var(--surf)",
                borderColor: onLeave
                  ? "rgba(239,68,68,.45)"
                  : isToday
                    ? "var(--acc)"
                    : "var(--bd)",
                opacity: isPast && !isToday ? 0.55 : 1,
              }}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-[11px] font-bold ${isToday ? "text-acc" : "text-t2"}`}
                >
                  {day}
                </span>
                {onLeave && (
                  <span
                    className="rounded px-1 text-[8px] font-bold uppercase"
                    style={{ background: "rgba(239,68,68,.2)", color: "#F87171" }}
                  >
                    Leave
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-1">
                {dayClasses.slice(0, maxChips).map((m) => {
                  const proposed = m.scheduleStatus === "proposed";
                  return (
                    <button
                      key={m.id}
                      onClick={onSelect ? () => onSelect(m) : undefined}
                      className="flex w-full items-center gap-1 rounded-md border px-1 py-0.5 text-left"
                      style={{
                        cursor: onSelect ? "pointer" : "default",
                        background: proposed ? "transparent" : "var(--panel)",
                        borderColor: proposed ? "var(--acc)" : "var(--bd)",
                        borderStyle: proposed ? "dashed" : "solid",
                        opacity: proposed ? 0.85 : 1,
                      }}
                      title={`${proposed ? "[Proposed] " : ""}${m.scheduledTime ?? ""} · ${
                        m.classroomName
                      }${m.subjectName ? ` · ${m.subjectName}` : ""}`}
                    >
                      <span
                        className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
                        style={{ background: statusAccent(m.status) }}
                      />
                      <span className="min-w-0 flex-1 truncate text-[9.5px] font-semibold text-t">
                        <span className="font-mono text-t2">{m.scheduledTime}</span>{" "}
                        {m.subjectName || m.classroomName}
                      </span>
                    </button>
                  );
                })}
                {dayClasses.length > maxChips && (
                  <span className="px-1 text-[9px] font-semibold text-t3">
                    +{dayClasses.length - maxChips} more
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
