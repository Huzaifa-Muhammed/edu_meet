"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import { HandHeart, X, Check, CalendarClock } from "lucide-react";
import api from "@/lib/api/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import type { CoverRequest } from "@/shared/types/domain";

type CoverRow = CoverRequest & { myState: "open" | "accepted" | "won" | "lost" };
type AcceptResp = { outcome: "assigned" | "contested" | "cancelled" };

const DISMISS_KEY = "edumeet:cover-dismissed";

function loadDismissed(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    return new Set(JSON.parse(localStorage.getItem(DISMISS_KEY) ?? "[]"));
  } catch {
    return new Set();
  }
}

/** Floating "AI needs a substitute" prompt. Polls open cover requests the
 *  teacher is eligible for and lets them accept right away. Mounted globally
 *  so it follows the teacher across the portal. */
export function CoverRequestPopup() {
  const { user } = useCurrentUser();
  const router = useRouter();
  const qc = useQueryClient();
  const [dismissed, setDismissed] = useState<Set<string>>(() => loadDismissed());

  const q = useQuery<CoverRow[]>({
    queryKey: ["teacher", "cover-requests"],
    queryFn: () => api.get("/teacher/cover-requests") as unknown as Promise<CoverRow[]>,
    enabled: !!user,
    refetchInterval: 30_000,
  });

  const acceptMut = useMutation({
    mutationFn: (id: string) =>
      api.post(`/teacher/cover-requests/${id}/accept`, {}) as Promise<AcceptResp>,
    onSuccess: (r) => {
      if (r.outcome === "assigned")
        toast.success("You're now covering this class — it's on your schedule.");
      else if (r.outcome === "contested")
        toast.info("Another teacher also accepted — an admin will decide who covers it.");
      else toast.message("This request is no longer available.");
      qc.invalidateQueries({ queryKey: ["teacher", "cover-requests"] });
      qc.invalidateQueries({ queryKey: ["teacher", "schedule"] });
      qc.invalidateQueries({ queryKey: ["teacher", "dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const open = useMemo(
    () => (q.data ?? []).filter((c) => c.myState === "open" && !dismissed.has(c.id)),
    [q.data, dismissed],
  );

  function dismiss(id: string) {
    setDismissed((prev) => {
      const next = new Set(prev).add(id);
      try {
        localStorage.setItem(DISMISS_KEY, JSON.stringify([...next]));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  if (open.length === 0) return null;
  const cr = open[0];
  const dateLabel = cr.scheduledDate
    ? format(new Date(`${cr.scheduledDate}T00:00:00`), "EEE, MMM d")
    : "—";

  return (
    <div
      className="fixed bottom-5 right-5 z-50 w-[330px] overflow-hidden rounded-2xl border shadow-2xl"
      style={{ background: "var(--surf)", borderColor: "var(--acc)" }}
    >
      <div
        className="flex items-center gap-2 px-4 py-2.5"
        style={{ background: "var(--accbg)" }}
      >
        <HandHeart className="h-4 w-4" style={{ color: "var(--acc)" }} />
        <span className="flex-1 text-xs font-bold text-t">
          AI needs a substitute teacher
        </span>
        <button
          onClick={() => dismiss(cr.id)}
          className="text-t3 hover:text-t"
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="p-4">
        <p className="text-sm font-bold text-t">{cr.classTitle}</p>
        {cr.subjectName && (
          <p className="mt-0.5 text-[11px] text-t3">{cr.subjectName}</p>
        )}
        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-t2">
          <CalendarClock className="h-3.5 w-3.5" />
          {dateLabel} · {cr.scheduledTime} · {cr.durationMin} min
        </div>
        <p className="mt-2 text-[11px] text-t3">
          {cr.originalTeacherName} is on leave. Accept to take this class — first
          to accept gets it.
        </p>

        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={() => acceptMut.mutate(cr.id)}
            disabled={acceptMut.isPending}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-acc px-3 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            <Check className="h-3.5 w-3.5" />
            {acceptMut.isPending ? "Accepting…" : "Accept"}
          </button>
          <button
            onClick={() => router.push("/teacher/schedule")}
            className="rounded-lg border border-bd bg-surf px-3 py-2 text-xs font-semibold text-t2 hover:bg-panel"
          >
            View all{open.length > 1 ? ` (${open.length})` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}
