"use client";
export const dynamic = "force-dynamic";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Check,
  X,
  Clock,
  CalendarOff,
  AlertTriangle,
  UserCog,
  HandHeart,
  Users,
} from "lucide-react";
import { format } from "date-fns";
import api from "@/lib/api/client";
import type { LeaveRequest, CoverRequest } from "@/shared/types/domain";

type Coverage = {
  meetings: {
    id: string;
    title: string;
    subjectName: string;
    scheduledDate: string;
    scheduledTime: string;
    currentTeacherId: string;
    substituteTeacherId: string | null;
  }[];
  candidates: { uid: string; name: string; sameSubject: boolean }[];
};

type Filter = "pending" | "approved" | "rejected" | "all";

function fmt(d: string) {
  return format(new Date(`${d}T00:00:00`), "MMM d, yyyy");
}

export default function AdminLeaveRequestsPage() {
  const [filter, setFilter] = useState<Filter>("pending");
  const queryClient = useQueryClient();

  const listQ = useQuery({
    queryKey: ["admin", "leave-requests", filter],
    queryFn: () =>
      api.get(
        filter === "all"
          ? "/admin/leave-requests"
          : `/admin/leave-requests?status=${filter}`,
      ) as Promise<LeaveRequest[]>,
  });

  const reviewMut = useMutation({
    mutationFn: ({
      id,
      status,
      reviewNote,
    }: {
      id: string;
      status: "approved" | "rejected";
      reviewNote?: string;
    }) =>
      api.patch(`/admin/leave-requests/${id}`, { status, reviewNote }) as Promise<unknown>,
    onSuccess: (_d, vars) => {
      toast.success(vars.status === "approved" ? "Leave approved" : "Leave rejected");
      queryClient.invalidateQueries({ queryKey: ["admin", "leave-requests"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "overview"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const counts = useMemo(() => {
    const list = listQ.data ?? [];
    return list.reduce(
      (acc, r) => {
        acc[r.status]++;
        return acc;
      },
      { pending: 0, approved: 0, rejected: 0 } as Record<string, number>,
    );
  }, [listQ.data]);

  // Surface emergency pending requests at the top.
  const sorted = useMemo(() => {
    return [...(listQ.data ?? [])].sort((a, b) => {
      const ae = a.emergency && a.status === "pending" ? 1 : 0;
      const be = b.emergency && b.status === "pending" ? 1 : 0;
      if (ae !== be) return be - ae;
      return (b.createdAt ?? "").localeCompare(a.createdAt ?? "");
    });
  }, [listQ.data]);

  return (
    <div className="bg-bg p-6">
      <div className="mx-auto max-w-5xl space-y-4">
        <div>
          <h1 className="text-lg font-semibold text-t">Teacher leave requests</h1>
          <p className="text-xs text-t3">
            Approve to mark those days off — the AI scheduler skips a teacher’s approved leave.
          </p>
        </div>

        <ContestedCoverPanel />

        <div className="flex flex-wrap gap-1 rounded-lg bg-panel p-1">
          {(["pending", "approved", "rejected", "all"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-[11px] font-medium capitalize ${
                filter === f ? "bg-surf text-t shadow-sm" : "text-t3"
              }`}
            >
              {f}
              {f !== "all" && counts[f] > 0 && (
                <span className="rounded-full bg-bd px-1.5 text-[9px] font-bold text-t2">
                  {counts[f]}
                </span>
              )}
            </button>
          ))}
        </div>

        {listQ.isLoading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-xl border border-bd bg-panel" />
            ))}
          </div>
        ) : !(listQ.data ?? []).length ? (
          <div className="rounded-xl border border-bd bg-surf p-10 text-center">
            <CalendarOff className="mx-auto mb-3 h-8 w-8 text-t3" />
            <p className="text-sm font-semibold text-t">No leave requests</p>
            <p className="mt-1 text-xs text-t3">
              {filter === "pending"
                ? "Nothing awaiting your review right now."
                : `No ${filter} leave requests.`}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {sorted.map((r) => (
              <LeaveCard
                key={r.id}
                leave={r}
                onApprove={() => reviewMut.mutate({ id: r.id, status: "approved" })}
                onReject={(note) =>
                  reviewMut.mutate({ id: r.id, status: "rejected", reviewNote: note })
                }
                pending={reviewMut.isPending}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function LeaveCard({
  leave,
  onApprove,
  onReject,
  pending,
}: {
  leave: LeaveRequest;
  onApprove: () => void;
  onReject: (note?: string) => void;
  pending: boolean;
}) {
  const [showReject, setShowReject] = useState(false);
  const [showCover, setShowCover] = useState(false);
  const [note, setNote] = useState("");
  const initials =
    leave.teacherName
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() ?? "?";
  const range =
    leave.endDate && leave.endDate !== leave.startDate
      ? `${fmt(leave.startDate)} – ${fmt(leave.endDate)}`
      : fmt(leave.startDate);

  return (
    <div className="rounded-xl border border-bd bg-surf p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-panel text-xs font-bold text-t">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-t">{leave.teacherName}</p>
            <StatusPill status={leave.status} />
            {leave.emergency && (
              <span className="flex items-center gap-1 rounded-full border border-rbd bg-rbg px-2 py-0.5 text-[10px] font-bold uppercase text-rt">
                <AlertTriangle className="h-3 w-3" />
                Emergency
              </span>
            )}
          </div>
          {leave.teacherEmail && (
            <p className="mt-0.5 text-[11px] text-t3">{leave.teacherEmail}</p>
          )}
        </div>
      </div>

      {leave.emergency && (
        <p className="mt-2 rounded-lg border border-rbd bg-rbg px-3 py-2 text-[11px] text-rt">
          ⚡ Starts within 48 hours — needs urgent review. Approve and assign a substitute to
          cover the affected classes.
        </p>
      )}

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Field label="Dates" value={range} />
        <Field label="Reason" value={leave.reason} />
      </div>

      {leave.reviewNote && leave.status === "rejected" && (
        <div className="mt-3 rounded-lg border border-rbd bg-rbg p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-rt">
            Your review note
          </p>
          <p className="mt-1 text-xs text-t">{leave.reviewNote}</p>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between">
        <p className="flex items-center gap-1 text-[10px] text-t3">
          <Clock className="h-3 w-3" />
          Submitted {new Date(leave.createdAt).toLocaleString()}
        </p>

        {leave.status === "pending" && (
          <div className="flex gap-2">
            {showReject ? (
              <div className="flex items-center gap-2">
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Optional note for the teacher…"
                  className="rounded-lg border border-bd bg-surf px-2 py-1 text-[11px] text-t outline-none focus:border-acc"
                />
                <button
                  onClick={() => {
                    onReject(note.trim() || undefined);
                    setShowReject(false);
                    setNote("");
                  }}
                  disabled={pending}
                  className="rounded-lg border border-rbd bg-rbg px-3 py-1.5 text-[11px] font-semibold text-rt hover:opacity-90 disabled:opacity-50"
                >
                  Confirm reject
                </button>
                <button
                  onClick={() => setShowReject(false)}
                  className="rounded-lg border border-bd bg-panel px-3 py-1.5 text-[11px] text-t2 hover:bg-surf"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <>
                <button
                  onClick={() => setShowReject(true)}
                  disabled={pending}
                  className="flex items-center gap-1 rounded-lg border border-rbd bg-rbg px-3 py-1.5 text-[11px] font-semibold text-rt hover:opacity-90 disabled:opacity-50"
                >
                  <X className="h-3 w-3" />
                  Reject
                </button>
                <button
                  onClick={onApprove}
                  disabled={pending}
                  className="flex items-center gap-1 rounded-lg border border-gbd bg-gbg px-3 py-1.5 text-[11px] font-semibold text-gt hover:opacity-90 disabled:opacity-50"
                >
                  <Check className="h-3 w-3" />
                  Approve
                </button>
              </>
            )}
          </div>
        )}

        {leave.status !== "pending" && leave.reviewedAt && (
          <p className="text-[10px] text-t3">
            Reviewed {new Date(leave.reviewedAt).toLocaleString()}
          </p>
        )}
      </div>

      <div className="mt-3 border-t border-bd pt-3">
        <button
          onClick={() => setShowCover((v) => !v)}
          className="flex items-center gap-1.5 text-[11px] font-semibold text-t2 hover:text-t"
        >
          <UserCog className="h-3.5 w-3.5" />
          {showCover ? "Hide cover" : "Assign cover for these dates"}
        </button>
        {showCover && <CoverPanel leaveId={leave.id} />}
      </div>
    </div>
  );
}

function ContestedCoverPanel() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin", "cover-requests", "contested"],
    queryFn: () =>
      api.get("/admin/cover-requests?status=contested") as Promise<CoverRequest[]>,
    refetchInterval: 30_000,
  });

  const resolveMut = useMutation({
    mutationFn: ({ id, teacherId }: { id: string; teacherId: string }) =>
      api.post(`/admin/cover-requests/${id}/resolve`, { teacherId }) as Promise<unknown>,
    onSuccess: () => {
      toast.success("Substitute assigned");
      qc.invalidateQueries({ queryKey: ["admin", "cover-requests"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = q.data ?? [];
  if (rows.length === 0) return null;

  return (
    <div className="rounded-xl border border-abd bg-abg p-4">
      <div className="flex items-center gap-2">
        <HandHeart className="h-4 w-4 text-at" />
        <p className="text-sm font-bold text-t">Contested cover requests</p>
        <span className="rounded-full bg-at px-1.5 py-0.5 text-[10px] font-bold text-white">
          {rows.length}
        </span>
      </div>
      <p className="mt-0.5 text-xs text-t2">
        More than one teacher accepted these classes. Choose who covers each.
      </p>

      <div className="mt-3 space-y-2">
        {rows.map((cr) => (
          <div key={cr.id} className="rounded-xl border border-bd bg-surf p-3">
            <p className="text-xs font-semibold text-t">
              {cr.classTitle}
              {cr.subjectName ? (
                <span className="ml-1 font-normal text-t3">· {cr.subjectName}</span>
              ) : null}
            </p>
            <p className="mt-0.5 text-[10px] text-t3">
              {fmt(cr.scheduledDate)} · {cr.scheduledTime} · originally{" "}
              {cr.originalTeacherName}
            </p>
            <div className="mt-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-t3">
              <Users className="h-3 w-3" />
              {cr.acceptances.length} teacher{cr.acceptances.length === 1 ? "" : "s"}{" "}
              accepted
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {cr.acceptances.map((a) => (
                <button
                  key={a.teacherId}
                  onClick={() =>
                    resolveMut.mutate({ id: cr.id, teacherId: a.teacherId })
                  }
                  disabled={resolveMut.isPending}
                  className="flex items-center gap-1.5 rounded-lg border border-gbd bg-gbg px-3 py-1.5 text-[11px] font-semibold text-gt hover:opacity-90 disabled:opacity-50"
                >
                  <Check className="h-3 w-3" />
                  Assign {a.teacherName}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CoverPanel({ leaveId }: { leaveId: string }) {
  const qc = useQueryClient();
  const covQ = useQuery({
    queryKey: ["admin", "leave-coverage", leaveId],
    queryFn: () =>
      api.get(`/admin/leave-requests/${leaveId}/coverage`) as Promise<Coverage>,
  });
  const [picks, setPicks] = useState<Record<string, string>>({});

  const assignMut = useMutation({
    mutationFn: ({ meetingId, teacherId }: { meetingId: string; teacherId: string }) =>
      api.post(`/admin/leave-requests/${leaveId}/assign`, { meetingId, teacherId }) as Promise<unknown>,
    onSuccess: () => {
      toast.success("Class reassigned to substitute");
      qc.invalidateQueries({ queryKey: ["admin", "leave-coverage", leaveId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const candidates = covQ.data?.candidates ?? [];
  const nameFor = (uid: string | null) =>
    uid ? candidates.find((c) => c.uid === uid)?.name ?? "Substitute" : null;

  if (covQ.isLoading) {
    return <div className="mt-3 h-16 animate-pulse rounded-lg bg-panel" />;
  }
  const meetings = covQ.data?.meetings ?? [];
  if (!meetings.length) {
    return (
      <p className="mt-3 text-[11px] text-t3">
        No classes are scheduled on these dates — nothing to reassign.
      </p>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      {meetings.map((m) => {
        const sub = nameFor(m.substituteTeacherId);
        return (
          <div
            key={m.id}
            className="flex flex-wrap items-center gap-2 rounded-lg border border-bd bg-panel px-3 py-2"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-t">
                {m.subjectName || m.title}
              </p>
              <p className="text-[10px] text-t3">
                {format(new Date(`${m.scheduledDate}T00:00:00`), "MMM d")} · {m.scheduledTime}
                {sub && (
                  <span className="ml-1 font-semibold text-gt">→ covered by {sub}</span>
                )}
              </p>
            </div>
            <select
              value={picks[m.id] ?? m.substituteTeacherId ?? ""}
              onChange={(e) => setPicks((p) => ({ ...p, [m.id]: e.target.value }))}
              className="rounded-lg border border-bd bg-surf px-2 py-1.5 text-[11px] text-t outline-none focus:border-acc"
            >
              <option value="">Choose teacher…</option>
              {candidates.map((c) => (
                <option key={c.uid} value={c.uid}>
                  {c.name}
                  {c.sameSubject ? " (same subject)" : ""}
                </option>
              ))}
            </select>
            <button
              onClick={() => {
                const teacherId = picks[m.id] ?? m.substituteTeacherId ?? "";
                if (!teacherId) {
                  toast.error("Pick a teacher first");
                  return;
                }
                assignMut.mutate({ meetingId: m.id, teacherId });
              }}
              disabled={assignMut.isPending}
              className="rounded-lg bg-acc px-3 py-1.5 text-[11px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              Assign
            </button>
          </div>
        );
      })}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-bd bg-panel px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-t3">{label}</p>
      <p className="mt-0.5 whitespace-pre-wrap text-sm text-t">{value}</p>
    </div>
  );
}

function StatusPill({ status }: { status: LeaveRequest["status"] }) {
  const map: Record<string, string> = {
    pending: "border-abd bg-abg text-at",
    approved: "border-gbd bg-gbg text-gt",
    rejected: "border-rbd bg-rbg text-rt",
  };
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[10px] font-bold capitalize ${map[status]}`}
    >
      {status}
    </span>
  );
}
