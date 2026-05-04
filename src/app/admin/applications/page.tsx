"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, X, Clock, GraduationCap } from "lucide-react";
import api from "@/lib/api/client";
import type { TeacherApplication } from "@/shared/types/domain";

type Filter = "pending" | "approved" | "rejected" | "all";

export default function AdminApplicationsPage() {
  const [filter, setFilter] = useState<Filter>("pending");
  const queryClient = useQueryClient();

  const appsQ = useQuery({
    queryKey: ["admin", "applications", filter],
    queryFn: () =>
      api.get(
        filter === "all"
          ? "/admin/teacher-applications"
          : `/admin/teacher-applications?status=${filter}`,
      ) as Promise<TeacherApplication[]>,
  });

  const reviewMutation = useMutation({
    mutationFn: ({
      id,
      status,
      reviewNote,
    }: {
      id: string;
      status: "approved" | "rejected";
      reviewNote?: string;
    }) =>
      api.patch(`/admin/teacher-applications/${id}`, {
        status,
        reviewNote,
      }) as Promise<unknown>,
    onSuccess: (_d, vars) => {
      toast.success(
        vars.status === "approved" ? "Teacher approved" : "Application rejected",
      );
      queryClient.invalidateQueries({ queryKey: ["admin", "applications"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "overview"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const counts = useMemo(() => {
    const list = appsQ.data ?? [];
    return list.reduce(
      (acc, a) => {
        acc[a.status]++;
        return acc;
      },
      { pending: 0, approved: 0, rejected: 0 } as Record<string, number>,
    );
  }, [appsQ.data]);

  return (
    <div className="bg-bg p-6">
      <div className="mx-auto max-w-5xl space-y-4">
        <div>
          <h1 className="text-lg font-semibold text-t">Teacher applications</h1>
          <p className="text-xs text-t3">
            Approve to grant access to the teacher portal, or reject with a note.
          </p>
        </div>

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

        {appsQ.isLoading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-32 animate-pulse rounded-xl border border-bd bg-panel"
              />
            ))}
          </div>
        ) : !(appsQ.data ?? []).length ? (
          <div className="rounded-xl border border-bd bg-surf p-10 text-center">
            <GraduationCap className="mx-auto mb-3 h-8 w-8 text-t3" />
            <p className="text-sm font-semibold text-t">No applications</p>
            <p className="mt-1 text-xs text-t3">
              {filter === "pending"
                ? "Nothing awaiting your review right now."
                : `No ${filter} applications.`}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {(appsQ.data ?? []).map((a) => (
              <ApplicationCard
                key={a.id}
                app={a}
                onApprove={() =>
                  reviewMutation.mutate({ id: a.id, status: "approved" })
                }
                onReject={(note) =>
                  reviewMutation.mutate({
                    id: a.id,
                    status: "rejected",
                    reviewNote: note,
                  })
                }
                pending={reviewMutation.isPending}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ApplicationCard({
  app,
  onApprove,
  onReject,
  pending,
}: {
  app: TeacherApplication;
  onApprove: () => void;
  onReject: (note?: string) => void;
  pending: boolean;
}) {
  const [showReject, setShowReject] = useState(false);
  const [note, setNote] = useState("");
  const initials =
    app.displayName
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() ?? "?";

  return (
    <div className="rounded-xl border border-bd bg-surf p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-panel2 text-xs font-bold text-t">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-t">{app.displayName}</p>
            <StatusPill status={app.status} />
          </div>
          <p className="mt-0.5 text-[11px] text-t3">{app.email}</p>
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <Field label="Subject" value={app.subject} />
        <Field
          label="Experience"
          value={`${app.yearsExperience} year${app.yearsExperience === 1 ? "" : "s"}`}
        />
        <Field label="Highest degree" value={app.highestDegree} />
      </div>

      {app.bio && (
        <div className="mt-3 rounded-lg border border-bd bg-panel p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-t3">
            Bio
          </p>
          <p className="mt-1 whitespace-pre-wrap text-xs text-t2">{app.bio}</p>
        </div>
      )}

      {app.reviewNote && app.status === "rejected" && (
        <div className="mt-3 rounded-lg border border-rbd bg-rbg p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-rt">
            Your previous review note
          </p>
          <p className="mt-1 text-xs text-t">{app.reviewNote}</p>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between">
        <p className="flex items-center gap-1 text-[10px] text-t3">
          <Clock className="h-3 w-3" />
          Submitted {new Date(app.submittedAt).toLocaleString()}
        </p>

        {app.status === "pending" && (
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
                  className="rounded-lg border border-bd bg-panel px-3 py-1.5 text-[11px] text-t2 hover:bg-panel2"
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

        {app.status !== "pending" && app.reviewedAt && (
          <p className="text-[10px] text-t3">
            Reviewed {new Date(app.reviewedAt).toLocaleString()}
          </p>
        )}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-bd bg-panel px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-t3">
        {label}
      </p>
      <p className="mt-0.5 truncate text-sm text-t" title={value}>
        {value}
      </p>
    </div>
  );
}

function StatusPill({ status }: { status: TeacherApplication["status"] }) {
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
