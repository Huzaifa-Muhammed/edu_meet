"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUpcomingMeetings, usePastMeetings } from "@/hooks/use-meeting";
import { useClassrooms } from "@/hooks/use-classrooms";
import { CreateClassForm } from "@/components/teacher/create-class-form";
import { ClassCard } from "@/components/shared/class-card";
import { Plus, Video, Radio } from "lucide-react";

export default function TeacherClassesPage() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { data: upcoming, isLoading: l1 } = useUpcomingMeetings();
  const { data: past, isLoading: l2 } = usePastMeetings();
  const { data: classrooms } = useClassrooms();

  const liveMeetings = upcoming?.filter((m) => m.status === "live") ?? [];
  const scheduledMeetings = upcoming?.filter((m) => m.status === "scheduled") ?? [];

  const nameFor = (cid: string) =>
    classrooms?.find((c) => c.id === cid)?.name ?? cid;

  const loading = l1 || l2;
  const hasAnyLive = liveMeetings.length > 0;
  const hasAny = (upcoming?.length ?? 0) + (past?.length ?? 0) > 0;

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto bg-bg p-6">
        <div className="mx-auto max-w-5xl">
          <div className="h-40 animate-pulse rounded-xl bg-panel" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-bg p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-t">Live & Scheduled Classes</h1>
            <p className="text-xs text-t3">
              Start a new class — students with matching subjects will see it on their dashboard.
            </p>
          </div>
          <button
            onClick={() => setOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-acc px-3 py-2 text-xs font-semibold text-white hover:opacity-90"
          >
            <Plus className="h-3.5 w-3.5" />
            New Class
          </button>
        </div>

        {!hasAny ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-bd bg-surf py-20 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accbg">
              <Video className="h-6 w-6 text-t" />
            </div>
            <h3 className="text-sm font-semibold text-t">No live class right now</h3>
            <p className="mt-1 max-w-sm text-xs text-t3">
              Create a new class to go live. A VideoSDK room is allocated for you and students
              in your subject will see it on their dashboard.
            </p>
            <button
              onClick={() => setOpen(true)}
              className="mt-5 flex items-center gap-1.5 rounded-lg bg-acc px-4 py-2 text-xs font-semibold text-white hover:opacity-90"
            >
              <Plus className="h-3.5 w-3.5" />
              Create Class
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            {hasAnyLive && (
              <section className="space-y-3">
                <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-green">
                  <Radio className="h-3.5 w-3.5 animate-pulse" />
                  Live now
                </h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {liveMeetings.map((m) => (
                    <ClassCard
                      key={m.id}
                      title={nameFor(m.classroomId)}
                      date={m.startedAt}
                      studentCount={m.participantIds?.length}
                      status="live"
                      onJoin={() => router.push(`/teacher/classroom/${m.id}`)}
                    />
                  ))}
                </div>
              </section>
            )}

            {scheduledMeetings.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-t3">
                  Scheduled
                </h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {scheduledMeetings.map((m) => (
                    <ClassCard
                      key={m.id}
                      title={nameFor(m.classroomId)}
                      date={m.startedAt}
                      studentCount={m.participantIds?.length}
                      status="scheduled"
                      onJoin={() => router.push(`/teacher/classroom/${m.id}`)}
                    />
                  ))}
                </div>
              </section>
            )}

            {past && past.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-t3">
                  Past
                </h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {past.map((m) => (
                    <ClassCard
                      key={m.id}
                      title={nameFor(m.classroomId)}
                      date={m.endedAt ?? m.startedAt}
                      studentCount={m.participantIds?.length}
                      status="ended"
                      onViewRecording={
                        m.recordingUrl ? () => window.open(m.recordingUrl!, "_blank") : undefined
                      }
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>

      <CreateClassForm
        open={open}
        onClose={() => setOpen(false)}
        onCreated={(meeting) => router.push(`/teacher/classroom/${meeting.id}`)}
      />
    </div>
  );
}
