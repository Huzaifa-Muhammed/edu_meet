"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Radio, CalendarClock, Video, X } from "lucide-react";
import api from "@/lib/api/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { classWindow, type ClassAlert } from "@/lib/schedule/class-window";

const DISMISS_KEY = "edumeet:class-reminder-dismissed:student";

function loadDismissed(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    return new Set(JSON.parse(localStorage.getItem(DISMISS_KEY) ?? "[]"));
  } catch {
    return new Set();
  }
}

type Active = {
  alert: ClassAlert;
  phase: "soon" | "live";
  startsInMin: number;
  live: boolean;
};

/** Live classes win; otherwise the soonest class that's imminent/ongoing. */
function pickActive(alerts: ClassAlert[], dismissed: Set<string>): Active | null {
  const candidates: Active[] = [];
  for (const a of alerts) {
    const w = classWindow(a.scheduledDate, a.scheduledTime, a.durationMin);
    if (w.ended) continue;
    const live = a.status === "live";
    if (!live && !w.imminent && !w.ongoing) continue;
    const phase: "soon" | "live" = live ? "live" : "soon";
    if (dismissed.has(`${a.meetingId}:${phase}`)) continue;
    candidates.push({ alert: a, phase, startsInMin: w.startsInMin, live });
  }
  candidates.sort((x, y) => {
    if (x.live !== y.live) return x.live ? -1 : 1;
    return x.startsInMin - y.startsInMin;
  });
  return candidates[0] ?? null;
}

/**
 * Floating reminder for students: a heads-up ~2 minutes before each class, and a
 * Join prompt once the teacher takes it live. Per the product rule, students
 * only join after the class is live — before that it's a "get ready" nudge.
 * Mounted globally so it follows the student across the portal.
 */
export function ClassReminderPopup() {
  const { user } = useCurrentUser();
  const router = useRouter();
  const [dismissed, setDismissed] = useState<Set<string>>(() => loadDismissed());
  const [tick, setTick] = useState(0);

  const q = useQuery<{ alerts: ClassAlert[] }>({
    queryKey: ["student", "class-alerts"],
    queryFn: () => api.get("/student/class-alerts") as unknown as Promise<{ alerts: ClassAlert[] }>,
    enabled: !!user,
    refetchInterval: 30_000,
  });

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 20_000);
    return () => clearInterval(id);
  }, []);

  // Recomputed every render; the 20s `tick` + the 30s poll keep it fresh so a
  // class transitions soon → live without user interaction.
  void tick;
  const active = pickActive(q.data?.alerts ?? [], dismissed);

  function dismiss(key: string) {
    setDismissed((prev) => {
      const next = new Set(prev).add(key);
      try {
        localStorage.setItem(DISMISS_KEY, JSON.stringify([...next]));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  if (!active) return null;
  const { alert: a, phase, startsInMin, live } = active;
  const mins = Math.max(0, Math.round(startsInMin));

  function join() {
    if (a.enrolled) router.push(`/student/classroom/${a.meetingId}`);
    else router.push("/student/dashboard"); // enroll-by-code lives on the dashboard
  }

  return (
    <div
      className="fixed bottom-5 right-5 z-50 w-[330px] overflow-hidden rounded-2xl border shadow-2xl"
      style={{ background: "var(--surf)", borderColor: "var(--acc)" }}
    >
      <div className="flex items-center gap-2 px-4 py-2.5" style={{ background: "var(--accbg)" }}>
        {live ? (
          <Radio className="h-4 w-4" style={{ color: "var(--acc)" }} />
        ) : (
          <CalendarClock className="h-4 w-4" style={{ color: "var(--acc)" }} />
        )}
        <span className="flex-1 text-xs font-bold text-t">
          {live ? "Your class is live now" : "Class starting soon"}
        </span>
        <button
          onClick={() => dismiss(`${a.meetingId}:${phase}`)}
          className="text-t3 hover:text-t"
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="p-4">
        <p className="text-sm font-bold text-t">{a.classroomName}</p>
        {a.subjectName && <p className="mt-0.5 text-[11px] text-t3">{a.subjectName}</p>}
        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-t2">
          <CalendarClock className="h-3.5 w-3.5" />
          {a.scheduledTime} · {a.durationMin} min
        </div>
        <p className="mt-2 text-[11px] text-t3">
          {live
            ? "Your teacher has started the class — join now."
            : mins <= 1
              ? "Starts in about a minute. Get ready — you can join once your teacher starts it."
              : `Starts in about ${mins} minutes. Get ready — you can join once your teacher starts it.`}
        </p>

        <div className="mt-3 flex items-center gap-2">
          {live ? (
            <button
              onClick={join}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-acc px-3 py-2 text-xs font-semibold text-white hover:opacity-90"
            >
              <Video className="h-3.5 w-3.5" />
              Join now
            </button>
          ) : (
            <button
              onClick={() => router.push("/student/dashboard")}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-bd bg-surf px-3 py-2 text-xs font-semibold text-t2 hover:bg-panel"
            >
              View schedule
            </button>
          )}
          <button
            onClick={() => dismiss(`${a.meetingId}:${phase}`)}
            className="rounded-lg border border-bd bg-surf px-3 py-2 text-xs font-semibold text-t2 hover:bg-panel"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
