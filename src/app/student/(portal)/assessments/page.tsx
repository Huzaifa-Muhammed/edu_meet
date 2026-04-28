"use client";

import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api/client";
import Link from "next/link";
import { format } from "date-fns";
import { ClipboardList, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";

type StudentAssessment = {
  id: string;
  title: string;
  instructions?: string;
  dueAt?: string;
  totalPoints: number;
  createdAt: string;
  classroomId: string;
  classroomName: string;
  submitted: boolean;
  submissionStatus: "submitted" | "graded" | null;
  finalScore: number | null;
  submittedAt: string | null;
};

export default function StudentAssessmentsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["student", "assessments"],
    queryFn: () =>
      api.get("/student/assessments") as unknown as Promise<StudentAssessment[]>,
  });

  if (isLoading) {
    return (
      <div className="flex-1 overflow-y-auto bg-bg p-6">
        <div className="mx-auto max-w-4xl space-y-3">
          <div className="h-6 w-48 animate-pulse rounded bg-panel" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-panel" />
          ))}
        </div>
      </div>
    );
  }

  const pending = data?.filter((a) => !a.submitted) ?? [];
  const done = data?.filter((a) => a.submitted) ?? [];

  return (
    <div className="flex-1 overflow-y-auto bg-bg p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <h1 className="text-lg font-semibold text-t">Assessments</h1>
          <p className="text-xs text-t3">
            Quizzes assigned by your teachers across all your classes.
          </p>
        </div>

        {!data?.length ? (
          <EmptyState
            icon={<ClipboardList className="h-8 w-8" />}
            title="No assessments yet"
            description="Your teachers haven't assigned anything. Check back later."
          />
        ) : (
          <>
            {pending.length > 0 && (
              <section className="space-y-2">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-t3">
                  To do ({pending.length})
                </h2>
                {pending.map((a) => (
                  <Row key={a.id} a={a} />
                ))}
              </section>
            )}

            {done.length > 0 && (
              <section className="space-y-2">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-t3">
                  Done ({done.length})
                </h2>
                {done.map((a) => (
                  <Row key={a.id} a={a} />
                ))}
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Row({ a }: { a: StudentAssessment }) {
  const overdue = !a.submitted && a.dueAt && new Date(a.dueAt).getTime() < Date.now();
  const scorePct =
    a.finalScore != null && a.totalPoints > 0
      ? Math.round((a.finalScore / a.totalPoints) * 100)
      : null;

  return (
    <Link
      href={`/student/assessments/${a.id}`}
      className="flex items-center gap-4 rounded-xl border border-bd bg-surf p-4 transition-shadow hover:shadow-sm"
    >
      <div
        className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${
          a.submitted ? "bg-gbg text-gt" : overdue ? "bg-rbg text-rt" : "bg-accbg text-t"
        }`}
      >
        {a.submitted ? (
          <CheckCircle2 className="h-4 w-4" />
        ) : overdue ? (
          <AlertCircle className="h-4 w-4" />
        ) : (
          <ClipboardList className="h-4 w-4" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-t">{a.title}</p>
        <p className="mt-0.5 truncate text-[11px] text-t3">
          {a.classroomName} · {a.totalPoints} pts
          {a.dueAt && (
            <>
              {" · "}Due {format(new Date(a.dueAt), "MMM d, h:mm a")}
            </>
          )}
        </p>
      </div>

      {a.submitted ? (
        <div className="flex flex-col items-end">
          {a.submissionStatus === "graded" && scorePct != null ? (
            <span
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                scorePct >= 70 ? "bg-gbg text-gt" : scorePct >= 50 ? "bg-abg text-at" : "bg-rbg text-rt"
              }`}
            >
              {scorePct}%
            </span>
          ) : (
            <span className="flex items-center gap-1 rounded-full bg-bbg px-2.5 py-0.5 text-[11px] font-semibold text-bt">
              <Clock className="h-3 w-3" />
              Awaiting grade
            </span>
          )}
          <p className="mt-0.5 text-[10px] text-t3">
            {a.submittedAt && format(new Date(a.submittedAt), "MMM d")}
          </p>
        </div>
      ) : (
        <span
          className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
            overdue ? "bg-rbg text-rt" : "bg-accbg text-t"
          }`}
        >
          {overdue ? "Overdue" : "Start"}
        </span>
      )}
    </Link>
  );
}
