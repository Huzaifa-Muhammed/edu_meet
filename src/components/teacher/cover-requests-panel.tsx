"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import { HandHeart, Check, Clock, CheckCircle2, XCircle } from "lucide-react";
import api from "@/lib/api/client";
import type { CoverRequest } from "@/shared/types/domain";

type MyState = "open" | "accepted" | "won" | "lost";
type CoverRow = CoverRequest & { myState: MyState };
type AcceptResp = { outcome: "assigned" | "contested" | "cancelled" };

function fmt(d: string) {
  return d ? format(new Date(`${d}T00:00:00`), "EEE, MMM d") : "—";
}

/** Cover-request marketplace surfaced on the teacher Schedule page — open
 *  same-subject classes they can pick up, plus the status of ones they've
 *  already accepted. */
export function CoverRequestsPanel() {
  const qc = useQueryClient();

  const q = useQuery<CoverRow[]>({
    queryKey: ["teacher", "cover-requests"],
    queryFn: () => api.get("/teacher/cover-requests") as unknown as Promise<CoverRow[]>,
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

  const rows = q.data ?? [];
  if (rows.length === 0) return null;

  return (
    <div
      className="rounded-2xl border p-4"
      style={{ background: "var(--accbg)", borderColor: "var(--acc)" }}
    >
      <div className="flex items-center gap-2">
        <HandHeart className="h-4 w-4" style={{ color: "var(--acc)" }} />
        <p className="text-sm font-bold text-t">Class cover requests</p>
        <span className="rounded-full bg-acc px-1.5 py-0.5 text-[10px] font-bold text-white">
          {rows.length}
        </span>
      </div>
      <p className="mt-0.5 text-xs text-t2">
        A same-subject teacher is on leave. Accept to take a class — first to
        accept gets it; if two accept, an admin decides.
      </p>

      <div className="mt-3 space-y-2">
        {rows.map((cr) => (
          <div
            key={cr.id}
            className="flex flex-wrap items-center gap-3 rounded-xl border border-bd bg-surf px-3 py-2.5"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-t">
                {cr.classTitle}
                {cr.subjectName ? (
                  <span className="ml-1 font-normal text-t3">· {cr.subjectName}</span>
                ) : null}
              </p>
              <p className="mt-0.5 text-[10px] text-t3">
                {fmt(cr.scheduledDate)} · {cr.scheduledTime} · {cr.durationMin} min ·
                covering for {cr.originalTeacherName}
              </p>
            </div>
            <StateAction cr={cr} accepting={acceptMut.isPending} onAccept={() => acceptMut.mutate(cr.id)} />
          </div>
        ))}
      </div>
    </div>
  );
}

function StateAction({
  cr,
  accepting,
  onAccept,
}: {
  cr: CoverRow;
  accepting: boolean;
  onAccept: () => void;
}) {
  if (cr.myState === "open")
    return (
      <button
        onClick={onAccept}
        disabled={accepting}
        className="flex items-center gap-1.5 rounded-lg bg-acc px-3 py-1.5 text-[11px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
      >
        <Check className="h-3.5 w-3.5" />
        {accepting ? "Accepting…" : "Accept"}
      </button>
    );
  if (cr.myState === "won")
    return (
      <span className="flex items-center gap-1 rounded-full border border-gbd bg-gbg px-2.5 py-1 text-[10px] font-bold text-gt">
        <CheckCircle2 className="h-3 w-3" />
        You're covering this
      </span>
    );
  if (cr.myState === "accepted")
    return (
      <span className="flex items-center gap-1 rounded-full border border-abd bg-abg px-2.5 py-1 text-[10px] font-bold text-at">
        <Clock className="h-3 w-3" />
        Awaiting admin decision
      </span>
    );
  return (
    <span className="flex items-center gap-1 rounded-full border border-bd bg-panel px-2.5 py-1 text-[10px] font-bold text-t3">
      <XCircle className="h-3 w-3" />
      Assigned to {cr.assignedTeacherName ?? "another teacher"}
    </span>
  );
}
