"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api/client";
import { EmptyState } from "@/components/shared/empty-state";
import { BarChart3, Search, TrendingUp, Users, CheckCircle2 } from "lucide-react";

type StudentReport = {
  uid: string;
  displayName?: string;
  email?: string;
  photoUrl?: string;
  classroomNames: string[];
  attendedMeetings: number;
  totalMeetings: number;
  participationPct: number;
  completedAssessments: number;
  totalAssessments: number;
  avgScorePct: number | null;
};

function scoreColor(pct: number | null) {
  if (pct == null) return "bg-panel text-t3";
  if (pct >= 80) return "bg-gbg text-gt";
  if (pct >= 60) return "bg-abg text-at";
  return "bg-rbg text-rt";
}

function participationColor(pct: number) {
  if (pct >= 80) return "bg-green";
  if (pct >= 50) return "bg-amber";
  return "bg-red";
}

export default function TeacherReportsPage() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "high" | "low">("all");

  const { data: reports, isLoading } = useQuery({
    queryKey: ["teacher", "reports"],
    queryFn: () =>
      api.get("/teacher/reports") as unknown as Promise<StudentReport[]>,
  });

  const filtered = useMemo(() => {
    let list = reports ?? [];
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (r) =>
          (r.displayName ?? "").toLowerCase().includes(q) ||
          (r.email ?? "").toLowerCase().includes(q),
      );
    }
    if (filter === "high") list = list.filter((r) => (r.avgScorePct ?? 0) >= 75);
    if (filter === "low") list = list.filter((r) => (r.avgScorePct ?? 100) < 60);
    return list;
  }, [reports, query, filter]);

  const totals = useMemo(() => {
    if (!reports?.length) return null;
    const avg =
      reports.filter((r) => r.avgScorePct != null).reduce((s, r) => s + (r.avgScorePct ?? 0), 0) /
      (reports.filter((r) => r.avgScorePct != null).length || 1);
    const avgPart =
      reports.reduce((s, r) => s + r.participationPct, 0) / reports.length;
    return {
      students: reports.length,
      avgScore: Math.round(avg),
      avgParticipation: Math.round(avgPart),
    };
  }, [reports]);

  if (isLoading) {
    return (
      <div className="flex-1 overflow-y-auto bg-bg p-6">
        <div className="mx-auto max-w-5xl">
          <div className="h-8 w-48 animate-pulse rounded bg-panel" />
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-panel" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-bg p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6">
          <h1 className="text-lg font-semibold text-t">Student Reports</h1>
          <p className="text-xs text-t3">
            Participation and average assessment scores across all your classes.
          </p>
        </div>

        {totals && (
          <div className="mb-6 grid gap-3 sm:grid-cols-3">
            <KpiCard
              icon={<Users className="h-4 w-4 text-t2" />}
              label="Students"
              value={totals.students}
            />
            <KpiCard
              icon={<TrendingUp className="h-4 w-4 text-t2" />}
              label="Avg Participation"
              value={`${totals.avgParticipation}%`}
            />
            <KpiCard
              icon={<CheckCircle2 className="h-4 w-4 text-t2" />}
              label="Avg Score"
              value={`${totals.avgScore}%`}
            />
          </div>
        )}

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-lg border border-bd bg-surf px-3 py-2">
            <Search className="h-3.5 w-3.5 text-t3" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or email…"
              className="flex-1 bg-transparent text-xs text-t outline-none"
            />
          </div>
          <div className="flex gap-1 rounded-lg bg-panel p-1">
            {(["all", "high", "low"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-md px-3 py-1 text-[11px] font-medium capitalize ${
                  filter === f ? "bg-surf text-t shadow-sm" : "text-t3"
                }`}
              >
                {f === "high" ? "Top performers" : f === "low" ? "Needs attention" : "All"}
              </button>
            ))}
          </div>
        </div>

        {!filtered.length ? (
          <EmptyState
            icon={<BarChart3 className="h-8 w-8" />}
            title="No student data yet"
            description="Reports show up after students attend classes and submit assessments."
          />
        ) : (
          <div className="space-y-2">
            {filtered.map((r) => (
              <div
                key={r.uid}
                className="flex items-center gap-4 rounded-xl border border-bd bg-surf p-4"
              >
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-panel text-xs font-semibold text-t2">
                  {(r.displayName ?? r.email ?? "?").slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-t">
                    {r.displayName ?? r.email ?? r.uid}
                  </p>
                  <p className="truncate text-[11px] text-t3">
                    {r.classroomNames.slice(0, 3).join(" · ") || "No classes"}
                  </p>
                </div>

                <div className="hidden flex-col items-end gap-0.5 sm:flex">
                  <p className="text-[10px] uppercase tracking-wide text-t3">Participation</p>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-bd">
                      <div
                        className={`h-full ${participationColor(r.participationPct)}`}
                        style={{ width: `${r.participationPct}%` }}
                      />
                    </div>
                    <span className="w-10 text-right text-xs font-mono text-t2">
                      {r.participationPct}%
                    </span>
                  </div>
                  <p className="mt-0.5 text-[10px] text-t3">
                    {r.attendedMeetings}/{r.totalMeetings} classes
                  </p>
                </div>

                <div className="flex flex-col items-end gap-0.5">
                  <p className="text-[10px] uppercase tracking-wide text-t3">Avg Score</p>
                  <span
                    className={`rounded-full px-3 py-0.5 text-xs font-semibold ${scoreColor(r.avgScorePct)}`}
                  >
                    {r.avgScorePct != null ? `${r.avgScorePct}%` : "—"}
                  </span>
                  <p className="mt-0.5 text-[10px] text-t3">
                    {r.completedAssessments}/{r.totalAssessments} done
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-bd bg-surf p-4">
      <div className="mb-1.5 flex items-center gap-2">
        {icon}
        <span className="text-[10px] font-semibold uppercase tracking-wider text-t3">
          {label}
        </span>
      </div>
      <p className="text-xl font-bold text-t">{value}</p>
    </div>
  );
}
