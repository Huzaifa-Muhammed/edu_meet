"use client";

import { useState } from "react";
import { DashboardUpcoming } from "@/components/teacher/dashboard-upcoming";
import { DashboardPast } from "@/components/teacher/dashboard-past";
import { CreateAssessmentForm } from "@/components/teacher/create-assessment-form";
import { useCurrentUser } from "@/hooks/use-current-user";

export default function TeacherDashboardPage() {
  const { user } = useCurrentUser();
  const [assessmentCtx, setAssessmentCtx] = useState<
    { classroomId: string; classroomName?: string } | null
  >(null);

  return (
    <div className="flex-1 overflow-y-auto bg-bg p-6">
      <div className="mx-auto max-w-5xl space-y-8">
        <div>
          <h1 className="text-lg font-semibold text-t">
            Welcome back, {user?.displayName?.split(" ")[0] ?? "Teacher"}
          </h1>
          <p className="text-xs text-t3">
            Here&apos;s what&apos;s happening with your classes
          </p>
        </div>

        <DashboardUpcoming
          onCreateAssessment={(classroomId, classroomName) =>
            setAssessmentCtx({ classroomId, classroomName })
          }
        />

        <DashboardPast
          onCreateAssessment={(classroomId, classroomName) =>
            setAssessmentCtx({ classroomId, classroomName })
          }
        />
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
