"use client";
export const dynamic = "force-dynamic";

import Link from "next/link";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import api from "@/lib/api/client";
import { Search } from "lucide-react";

type PendingItem = {
  assessmentId: string;
  assessmentTitle: string;
  classroomId: string;
  classroomName: string;
  uid: string;
  studentName?: string;
  studentEmail?: string;
  submittedAt: string;
  autoScore: number;
  totalPoints: number;
};

export default function TeacherGradingPage() {
  const [q, setQ] = useState("");
  const [classroomFilter, setClassroomFilter] = useState<string | "all">("all");

  const itemsQ = useQuery<PendingItem[]>({
    queryKey: ["teacher", "grading"],
    queryFn: () =>
      api.get("/teacher/grading") as unknown as Promise<PendingItem[]>,
    refetchInterval: 30_000,
  });

  const items = itemsQ.data ?? [];

  const classrooms = useMemo(() => {
    const map = new Map<string, string>();
    for (const it of items) map.set(it.classroomId, it.classroomName);
    return [...map.entries()];
  }, [items]);

  const filtered = useMemo(() => {
    return items.filter((it) => {
      if (classroomFilter !== "all" && it.classroomId !== classroomFilter)
        return false;
      if (q.trim()) {
        const needle = q.toLowerCase();
        return (
          (it.studentName ?? "").toLowerCase().includes(needle) ||
          (it.studentEmail ?? "").toLowerCase().includes(needle) ||
          it.assessmentTitle.toLowerCase().includes(needle)
        );
      }
      return true;
    });
  }, [items, classroomFilter, q]);

  if (itemsQ.isLoading) {
    return (
      <div className="min-h-full bg-bg p-6">
        <div className="mx-auto max-w-5xl space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-panel" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-bg p-6">
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-lg border border-bd bg-surf px-3 py-2">
            <Search className="h-3.5 w-3.5 text-t3" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by student or assessment…"
              className="flex-1 bg-transparent text-xs text-t outline-none placeholder:text-t3"
            />
          </div>
          {classrooms.length > 0 && (
            <select
              value={classroomFilter}
              onChange={(e) => setClassroomFilter(e.target.value)}
              className="rounded-lg border border-bd bg-surf px-3 py-2 text-xs text-t outline-none"
            >
              <option value="all">All classes</option>
              {classrooms.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-bd bg-surf py-20 text-center">
            <div
              className="mb-3 flex h-12 w-12 items-center justify-center rounded-full text-[22px]"
              style={{ background: "rgba(74,222,128,.14)" }}
            >
              ✅
            </div>
            <h3 className="text-sm font-semibold text-t">All graded</h3>
            <p className="mt-1 text-xs text-t3">
              No short-answer submissions waiting for review.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((it) => (
              <Link
                key={`${it.assessmentId}-${it.uid}`}
                href={`/teacher/assessments/${it.assessmentId}?grade=${it.uid}`}
                className="flex items-center gap-3 rounded-xl border border-bd bg-surf p-4 transition-colors hover:bg-panel2"
              >
                <div
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                  style={{ background: "linear-gradient(135deg,#F59E0B,#D97706)" }}
                >
                  {(it.studentName ?? it.studentEmail ?? "?").slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-t">
                    {it.studentName ?? it.studentEmail ?? it.uid}
                  </p>
                  <p className="truncate text-[11px] text-t3">
                    {it.assessmentTitle} · {it.classroomName}
                    {it.submittedAt &&
                      ` · submitted ${format(new Date(it.submittedAt), "MMM d, h:mm a")}`}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-0.5">
                  <span className="text-[10px] uppercase tracking-wide text-t3">
                    Auto so far
                  </span>
                  <span className="rounded-full bg-bbg px-3 py-0.5 text-xs font-semibold text-bt">
                    {it.autoScore}/{it.totalPoints || "?"}
                  </span>
                </div>
                <span
                  className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase"
                  style={{
                    background: "rgba(245,158,11,.16)",
                    color: "#FCD34D",
                    letterSpacing: "0.3px",
                  }}
                >
                  Needs grade
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
