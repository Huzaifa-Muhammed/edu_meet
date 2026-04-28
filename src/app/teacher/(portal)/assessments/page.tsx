"use client";

import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api/client";
import { EmptyState } from "@/components/shared/empty-state";
import { ClipboardList, Plus } from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";
import type { Assessment } from "@/shared/types/domain";

export default function TeacherAssessmentsPage() {
  const { data: assessments, isLoading } = useQuery({
    queryKey: ["assessments"],
    queryFn: () => api.get("/assessments") as unknown as Assessment[],
  });

  const statusColors: Record<string, string> = {
    draft: "bg-panel2 text-t2",
    assigned: "bg-gbg text-gt",
    closed: "bg-rbg text-rt",
  };

  return (
    <div className="flex-1 overflow-y-auto bg-bg p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-t">Assessments</h1>
          <button className="flex items-center gap-1.5 rounded-lg bg-acc px-3 py-2 text-xs font-semibold text-white hover:opacity-90">
            <Plus className="h-3.5 w-3.5" />
            Create Assessment
          </button>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-panel" />
            ))}
          </div>
        ) : !assessments?.length ? (
          <EmptyState
            icon={<ClipboardList className="h-8 w-8" />}
            title="No assessments yet"
            description="Create your first assessment from the dashboard"
          />
        ) : (
          <div className="space-y-3">
            {assessments.map((a) => (
              <Link
                key={a.id}
                href={`/teacher/assessments/${a.id}`}
                className="flex items-center justify-between rounded-xl border border-bd bg-surf p-4 transition-shadow hover:shadow-md"
              >
                <div>
                  <h3 className="text-sm font-semibold text-t">{a.title}</h3>
                  <p className="mt-0.5 text-xs text-t3">
                    {a.totalPoints} pts
                    {a.dueAt && ` · Due ${format(new Date(a.dueAt), "MMM d")}`}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${statusColors[a.status] ?? ""}`}
                >
                  {a.status}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
