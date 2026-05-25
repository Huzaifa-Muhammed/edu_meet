"use client";
export const dynamic = "force-dynamic";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Search } from "lucide-react";
import api from "@/lib/api/client";

type StudentRow = {
  uid: string;
  displayName?: string;
  email?: string;
  photoUrl?: string;
  classroomIds: string[];
  classroomNames: string[];
  subjects: string[];
  enrolledSince?: string;
  blocked?: boolean;
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

export default function TeacherStudentsPage() {
  const [q, setQ] = useState("");
  const [classFilter, setClassFilter] = useState<string | "all">("all");

  const studentsQ = useQuery<StudentRow[]>({
    queryKey: ["teacher", "students"],
    queryFn: () =>
      api.get("/teacher/students") as unknown as Promise<StudentRow[]>,
  });

  const rows = studentsQ.data ?? [];

  const classes = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rows)
      r.classroomIds.forEach((id, i) => map.set(id, r.classroomNames[i] ?? "Class"));
    return [...map.entries()];
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (classFilter !== "all" && !r.classroomIds.includes(classFilter))
        return false;
      if (q.trim()) {
        const needle = q.toLowerCase();
        return (
          (r.displayName ?? "").toLowerCase().includes(needle) ||
          (r.email ?? "").toLowerCase().includes(needle) ||
          r.subjects.some((s) => s.toLowerCase().includes(needle))
        );
      }
      return true;
    });
  }, [rows, q, classFilter]);

  return (
    <div className="min-h-full bg-bg p-6">
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-lg border border-bd bg-surf px-3 py-2">
            <Search className="h-3.5 w-3.5 text-t3" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, email, subject…"
              className="flex-1 bg-transparent text-xs text-t outline-none placeholder:text-t3"
            />
          </div>
          {classes.length > 0 && (
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="rounded-lg border border-bd bg-surf px-3 py-2 text-xs text-t outline-none"
            >
              <option value="all">All classes</option>
              {classes.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          )}
        </div>

        {studentsQ.isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-panel" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-bd bg-surf py-20 text-center">
            <div
              className="mb-3 flex h-12 w-12 items-center justify-center rounded-full text-[22px]"
              style={{ background: "rgba(245,158,11,.14)" }}
            >
              👥
            </div>
            <h3 className="text-sm font-semibold text-t">No students yet</h3>
            <p className="mt-1 max-w-sm text-xs text-t3">
              Students who enroll in your classes will appear here automatically.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-[11px] text-t3">
              {filtered.length} student{filtered.length === 1 ? "" : "s"}
              {classFilter !== "all" && " in this class"}
            </p>
            {filtered.map((r) => (
              <div
                key={r.uid}
                className="flex items-center gap-4 rounded-xl border border-bd bg-surf p-4"
              >
                <div
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                  style={{ background: avBg(r.uid) }}
                >
                  {(r.displayName ?? r.email ?? "?")
                    .split(/[\s@.]+/)
                    .map((p) => p[0])
                    .filter(Boolean)
                    .slice(0, 2)
                    .join("")
                    .toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-t">
                      {r.displayName ?? r.email ?? r.uid}
                    </p>
                    {r.blocked && (
                      <span
                        className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase"
                        style={{ background: "rgba(239,68,68,.16)", color: "#F87171" }}
                      >
                        Blocked
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-t3">
                    {r.email ?? "—"}
                    {r.enrolledSince &&
                      ` · since ${format(new Date(r.enrolledSince), "MMM d, yyyy")}`}
                  </p>
                </div>

                <div className="hidden flex-col items-end gap-0.5 sm:flex">
                  <p className="text-[10px] uppercase tracking-wide text-t3">
                    In your classes
                  </p>
                  <div className="flex flex-wrap justify-end gap-1">
                    {r.classroomNames.slice(0, 3).map((n, i) => (
                      <span
                        key={i}
                        className="rounded-full px-2 py-px text-[9.5px] font-semibold"
                        style={{
                          background: "rgba(245,158,11,.14)",
                          color: "#FCD34D",
                        }}
                      >
                        {n}
                      </span>
                    ))}
                    {r.classroomNames.length > 3 && (
                      <span className="text-[9.5px] text-t3">
                        +{r.classroomNames.length - 3}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
