"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Radio, CalendarClock, Video, X } from "lucide-react";
import api from "@/lib/api/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { classWindow, type ClassAlert } from "@/lib/schedule/class-window";

const DISMISS_KEY = "edumeet:class-reminder-dismissed:teacher";

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

/** Picks the single most relevant class to nudge about: anything live/ongoing
 *  wins, otherwise the soonest imminent class. Returns null when nothing is due. */
function pickActive(alerts: ClassAlert[], dismissed: Set<string>): Active | null {
  const candidates: Active[] = [];
  for (const a of alerts) {
    const w = classWindow(a.scheduledDate, a.scheduledTime, a.durationMin);
    if (w.ended) continue;
    const live = a.status === "live" || w.ongoing;
    if (!live && !w.imminent) continue;
    const phase: "soon" | "live" = live ? "live" : "soon";
    if (dismissed.has(`${a.meetingId}:${phase}`)) continue;
    candidates.push({ alert: a, phase, startsInMin: w.startsInMin, live });
  }
  candidates.sort((x, y) => {
    if (x.live !== y.live) return x.live ? -1 : 1; // live/ongoing first
    return x.startsInMin - y.startsInMin; // then soonest
  });
  return candidates[0] ?? null;
}

/**
 * Floating reminder that nudges a teacher ~2 minutes before each scheduled class
 * and again once it's live/ongoing, so they can jump straight in (the classroom
 * page auto-starts the meeting). Mounted globally so it follows them across the
 * portal. Dismissals are per class + phase, so dismissing the early reminder
 * doesn't suppress the "it's live" prompt.
 */
export function ClassReminderPopup() {
  const { user } = useCurrentUser();
  const router = useRouter();
  const [dismissed, setDismissed] = useState<Set<string>>(() => loadDismissed());
  const [tick, setTick] = useState(0);

  const q = useQuery<{ alerts: ClassAlert[] }>({
    queryKey: ["teacher", "class-alerts"],
    queryFn: () => api.get("/teacher/class-alerts") as unknown as Promise<{ alerts: ClassAlert[] }>,
    enabled: !!user,
    refetchInterval: 30_000,
  });

  // Re-evaluate the time windows on a timer even between refetches, so a class
  // transitions soon → live on the client without waiting for the next poll.
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

  return (
    <div
      className="fixed bottom-5 left-20 z-50 w-[330px] overflow-hidden rounded-2xl border shadow-2xl"
      style={{ background: "var(--surf)", borderColor: "var(--acc)" }}
    >
      <div className="flex items-center gap-2 px-4 py-2.5" style={{ background: "var(--accbg)" }}>
        {live ? (
          <Radio className="h-4 w-4" style={{ color: "var(--acc)" }} />
        ) : (
          <CalendarClock className="h-4 w-4" style={{ color: "var(--acc)" }} />
        )}
        <span className="flex-1 text-xs font-bold text-t">
          {live ? "Your class is starting" : "Class starting soon"}
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
          {a.status === "live"
            ? "Your class is live — re-enter to continue teaching."
            : live
              ? "It's time — join now to start the class for your students."
              : mins <= 1
                ? "Starts in about a minute. Join to start when you're ready."
                : `Starts in about ${mins} minutes. Join to start when you're ready.`}
        </p>

        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={() => router.push(`/teacher/classroom/${a.meetingId}`)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-acc px-3 py-2 text-xs font-semibold text-white hover:opacity-90"
          >
            <Video className="h-3.5 w-3.5" />
            {a.status === "live" ? "Re-enter" : "Join & start"}
          </button>
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
