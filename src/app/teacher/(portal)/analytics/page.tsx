"use client";
export const dynamic = "force-dynamic";

import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import api from "@/lib/api/client";

type Bucket = "0-25" | "25-50" | "50-75" | "75-100";
type ClassAnalytics = {
  classroomId: string;
  classroomName: string;
  studentCount: number;
  meetingsHeld: number;
  avgAttendancePct: number;
  assessmentsAssigned: number;
  submissionRate: number;
  avgScorePct: number | null;
};
type AnalyticsResp = {
  perClass: ClassAnalytics[];
  totals: {
    classes: number;
    students: number;
    meetingsHeld: number;
    avgAttendancePct: number;
    avgScorePct: number | null;
  };
  scoreDistribution: Record<Bucket, number>;
  attendanceTrend: Array<{ date: string; attendedAvgPct: number; meetings: number }>;
};

export default function TeacherAnalyticsPage() {
  const q = useQuery<AnalyticsResp>({
    queryKey: ["teacher", "analytics"],
    queryFn: () => api.get("/teacher/analytics") as unknown as Promise<AnalyticsResp>,
    refetchInterval: 60_000,
  });

  if (q.isLoading)
    return (
      <div className="min-h-full bg-bg p-6">
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-3 sm:grid-cols-5">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-panel" />
            ))}
          </div>
          <div className="mt-6 h-64 animate-pulse rounded-2xl bg-panel" />
        </div>
      </div>
    );

  const d = q.data;
  if (!d) return null;
  const distMax = Math.max(...Object.values(d.scoreDistribution), 1);
  const trendMax = Math.max(...d.attendanceTrend.map((t) => t.attendedAvgPct), 100);

  return (
    <div className="min-h-full bg-bg p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Totals */}
        <div className="grid gap-3 sm:grid-cols-5">
          <Kpi label="Classes" value={d.totals.classes} />
          <Kpi label="Students" value={d.totals.students} />
          <Kpi label="Classes held" value={d.totals.meetingsHeld} />
          <Kpi label="Avg attendance" value={`${d.totals.avgAttendancePct}%`} />
          <Kpi
            label="Avg score"
            value={d.totals.avgScorePct != null ? `${d.totals.avgScorePct}%` : "—"}
          />
        </div>

        {/* Attendance trend (last 14 days) */}
        <Card title="📈 Attendance trend · last 14 days">
          {d.attendanceTrend.every((t) => t.meetings === 0) ? (
            <p className="text-[11px] text-t3">
              No classes ended in the last 14 days — nothing to chart yet.
            </p>
          ) : (
            <div className="flex items-end gap-1.5">
              {d.attendanceTrend.map((t) => {
                const h = Math.max(4, Math.round((t.attendedAvgPct / trendMax) * 100));
                return (
                  <div key={t.date} className="flex flex-1 flex-col items-center gap-1">
                    <div
                      title={`${format(new Date(t.date), "MMM d")} · ${t.attendedAvgPct}%`}
                      style={{
                        height: `${h}%`,
                        minHeight: 4,
                        width: "100%",
                        maxWidth: 28,
                        background:
                          t.meetings > 0
                            ? "linear-gradient(180deg,#FCD34D,#D97706)"
                            : "rgba(255,255,255,.06)",
                        borderRadius: 4,
                      }}
                    />
                    <span className="text-[8.5px] text-white/35">
                      {format(new Date(t.date), "d")}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Score distribution */}
        <Card title="🎯 Score distribution (graded submissions)">
          <div className="grid grid-cols-4 gap-3">
            {(["0-25", "25-50", "50-75", "75-100"] as Bucket[]).map((b) => {
              const v = d.scoreDistribution[b];
              const pct = Math.round((v / distMax) * 100);
              return (
                <div key={b} className="flex flex-col items-center gap-2">
                  <div
                    className="flex h-32 w-full items-end overflow-hidden rounded-[10px]"
                    style={{
                      background: "rgba(255,255,255,.04)",
                      border: "1px solid rgba(255,255,255,.06)",
                    }}
                  >
                    <div
                      style={{
                        width: "100%",
                        height: `${pct}%`,
                        background:
                          b === "75-100"
                            ? "linear-gradient(180deg,#86EFAC,#16A34A)"
                            : b === "50-75"
                              ? "linear-gradient(180deg,#A5B4FC,#6366F1)"
                              : b === "25-50"
                                ? "linear-gradient(180deg,#FCD34D,#D97706)"
                                : "linear-gradient(180deg,#FCA5A5,#DC2626)",
                      }}
                    />
                  </div>
                  <p className="text-[18px] font-extrabold text-white">{v}</p>
                  <p className="text-[10px] text-white/45">{b}%</p>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Per-class */}
        <Card title="📚 Per-class breakdown">
          {d.perClass.length === 0 ? (
            <p className="text-[11px] text-t3">No classrooms yet.</p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-bd">
              <table className="w-full text-[11.5px]">
                <thead>
                  <tr className="bg-panel text-left text-[10px] uppercase tracking-wide text-t3">
                    <th className="px-3 py-2.5">Class</th>
                    <th className="px-3 py-2.5">Students</th>
                    <th className="px-3 py-2.5">Held</th>
                    <th className="px-3 py-2.5">Attendance</th>
                    <th className="px-3 py-2.5">Submitted</th>
                    <th className="px-3 py-2.5 text-right">Avg score</th>
                  </tr>
                </thead>
                <tbody>
                  {d.perClass.map((c) => (
                    <tr
                      key={c.classroomId}
                      className="border-t border-bd"
                      style={{ background: "rgba(255,255,255,.02)" }}
                    >
                      <td className="px-3 py-2.5 font-semibold text-t">
                        {c.classroomName}
                      </td>
                      <td className="px-3 py-2.5 text-t2">{c.studentCount}</td>
                      <td className="px-3 py-2.5 text-t2">{c.meetingsHeld}</td>
                      <td className="px-3 py-2.5 text-t2">
                        <Mini value={c.avgAttendancePct} tone="amber" />
                      </td>
                      <td className="px-3 py-2.5 text-t2">
                        <Mini value={c.submissionRate} tone="blue" />
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        {c.avgScorePct != null ? (
                          <span
                            className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                            style={{
                              background:
                                c.avgScorePct >= 75
                                  ? "rgba(74,222,128,.14)"
                                  : c.avgScorePct >= 50
                                    ? "rgba(245,158,11,.14)"
                                    : "rgba(239,68,68,.14)",
                              color:
                                c.avgScorePct >= 75
                                  ? "#86EFAC"
                                  : c.avgScorePct >= 50
                                    ? "#FCD34D"
                                    : "#F87171",
                            }}
                          >
                            {c.avgScorePct}%
                          </span>
                        ) : (
                          <span className="text-t3">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-bd bg-surf p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-t3">{label}</p>
      <p className="mt-1 text-xl font-bold text-t">{value}</p>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-bd bg-surf p-4">
      <p className="mb-3 text-[12px] font-bold text-t" style={{ letterSpacing: "-0.2px" }}>
        {title}
      </p>
      {children}
    </div>
  );
}

function Mini({ value, tone }: { value: number; tone: "amber" | "blue" }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-bd">
        <div
          className="h-full"
          style={{
            width: `${Math.min(100, value)}%`,
            background:
              tone === "amber"
                ? "linear-gradient(90deg,#FCD34D,#D97706)"
                : "linear-gradient(90deg,#A5B4FC,#6366F1)",
          }}
        />
      </div>
      <span className="font-mono text-[10.5px] text-t2">{value}%</span>
    </div>
  );
}
