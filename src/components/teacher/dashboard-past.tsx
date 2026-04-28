"use client";

import { usePastMeetings } from "@/hooks/use-meeting";
import { useClassrooms } from "@/hooks/use-classrooms";
import { ClassCard } from "@/components/shared/class-card";
import { EmptyState } from "@/components/shared/empty-state";
import { History } from "lucide-react";

export function DashboardPast({
  onCreateAssessment,
}: {
  onCreateAssessment?: (classroomId: string, classroomName?: string) => void;
}) {
  const { data: meetings, isLoading } = usePastMeetings();
  const { data: classrooms } = useClassrooms();

  const nameFor = (cid: string) =>
    classrooms?.find((c) => c.id === cid)?.name ?? cid;

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-28 rounded-xl bg-panel" />
        ))}
      </div>
    );
  }

  if (!meetings?.length) {
    return (
      <div className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-t3">
          Past Classes
        </h2>
        <EmptyState
          icon={<History className="h-8 w-8" />}
          title="No past classes yet"
          description="Your completed classes will appear here"
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-t3">
        Past Classes
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {meetings.map((m) => (
          <ClassCard
            key={m.id}
            title={nameFor(m.classroomId)}
            date={m.endedAt ?? m.startedAt}
            studentCount={m.participantIds?.length}
            status="ended"
            onViewRecording={
              m.recordingUrl ? () => window.open(m.recordingUrl!, "_blank") : undefined
            }
            onCreateAssessment={
              onCreateAssessment
                ? () => onCreateAssessment(m.classroomId, nameFor(m.classroomId))
                : undefined
            }
          />
        ))}
      </div>
    </div>
  );
}
