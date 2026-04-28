"use client";

import { useRouter } from "next/navigation";
import { useUpcomingMeetings } from "@/hooks/use-meeting";
import { useClassrooms } from "@/hooks/use-classrooms";
import { ClassCard } from "@/components/shared/class-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Calendar } from "lucide-react";

export function DashboardUpcoming({
  onCreateAssessment,
}: {
  onCreateAssessment?: (classroomId: string, classroomName?: string) => void;
}) {
  const { data: meetings, isLoading } = useUpcomingMeetings();
  const { data: classrooms } = useClassrooms();
  const router = useRouter();

  const nameFor = (cid: string) =>
    classrooms?.find((c) => c.id === cid)?.name ?? cid;

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-40 rounded-xl bg-panel" />
      </div>
    );
  }

  if (!meetings?.length) {
    return (
      <div className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-t3">
          Upcoming Class
        </h2>
        <EmptyState
          icon={<Calendar className="h-8 w-8" />}
          title="No upcoming classes"
          description="Head to the Classes page to start a new one"
        />
      </div>
    );
  }

  const [hero, ...rest] = meetings;

  return (
    <div className="space-y-4">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-t3">
        Upcoming Class
      </h2>
      <ClassCard
        title={nameFor(hero.classroomId)}
        subtitle={`${hero.participantIds?.length ?? 0} students joined`}
        date={hero.startedAt}
        studentCount={hero.participantIds?.length}
        status={hero.status as "scheduled" | "live"}
        onJoin={() => router.push(`/teacher/classroom/${hero.id}`)}
        onCreateAssessment={
          onCreateAssessment
            ? () => onCreateAssessment(hero.classroomId, nameFor(hero.classroomId))
            : undefined
        }
        className="border-2"
      />

      {rest.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rest.map((m) => (
            <ClassCard
              key={m.id}
              title={nameFor(m.classroomId)}
              date={m.startedAt}
              studentCount={m.participantIds?.length}
              status={m.status as "scheduled" | "live"}
              onJoin={() => router.push(`/teacher/classroom/${m.id}`)}
              onCreateAssessment={
                onCreateAssessment
                  ? () => onCreateAssessment(m.classroomId, nameFor(m.classroomId))
                  : undefined
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
