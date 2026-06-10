"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { X, CalendarOff } from "lucide-react";
import { format } from "date-fns";
import api from "@/lib/api/client";
import type { LeaveRequest } from "@/shared/types/domain";

function fmt(d: string) {
  return format(new Date(`${d}T00:00:00`), "MMM d, yyyy");
}

export function LeaveModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");

  const listQ = useQuery({
    queryKey: ["teacher", "leave"],
    queryFn: () => api.get("/teacher/leave") as Promise<LeaveRequest[]>,
  });

  const createMut = useMutation({
    mutationFn: () =>
      api.post("/teacher/leave", {
        startDate,
        endDate: endDate || undefined,
        reason,
      }) as Promise<unknown>,
    onSuccess: () => {
      toast.success("Leave request submitted — admin will review it.");
      setStartDate("");
      setEndDate("");
      setReason("");
      queryClient.invalidateQueries({ queryKey: ["teacher", "leave"] });
      queryClient.invalidateQueries({ queryKey: ["teacher", "schedule"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canSubmit = startDate && reason.trim().length >= 3 && !createMut.isPending;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,.55)" }}
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-bd bg-surf"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-bd px-5 py-4">
          <div className="flex items-center gap-2">
            <CalendarOff className="h-4 w-4 text-acc" />
            <h3 className="text-base font-bold text-t">Apply for leave</h3>
          </div>
          <button onClick={onClose} className="text-t3 hover:text-t">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto p-5">
          {/* Form */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold text-t2">From</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-lg border border-bd bg-panel px-2.5 py-2 text-xs text-t outline-none focus:border-acc"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold text-t2">
                  To <span className="text-t3">(optional)</span>
                </span>
                <input
                  type="date"
                  value={endDate}
                  min={startDate || undefined}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full rounded-lg border border-bd bg-panel px-2.5 py-2 text-xs text-t outline-none focus:border-acc"
                />
              </label>
            </div>
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold text-t2">Reason</span>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="e.g. Medical appointment, personal emergency…"
                className="w-full resize-none rounded-lg border border-bd bg-panel px-2.5 py-2 text-xs text-t outline-none focus:border-acc"
              />
            </label>
            <button
              onClick={() => createMut.mutate()}
              disabled={!canSubmit}
              className="w-full rounded-lg bg-acc px-3 py-2.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-40"
            >
              {createMut.isPending ? "Submitting…" : "Submit leave request"}
            </button>
            <p className="text-[10px] text-t3">
              On approval, those days are marked on your calendar and the AI won’t schedule
              classes for them.
            </p>
          </div>

          {/* Existing requests */}
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-t3">
              Your requests
            </p>
            {listQ.isLoading ? (
              <div className="h-16 animate-pulse rounded-lg bg-panel" />
            ) : !(listQ.data ?? []).length ? (
              <p className="text-xs text-t3">No leave requests yet.</p>
            ) : (
              <div className="space-y-2">
                {(listQ.data ?? []).map((r) => (
                  <div
                    key={r.id}
                    className="rounded-lg border border-bd bg-panel p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-t">
                        {fmt(r.startDate)}
                        {r.endDate && r.endDate !== r.startDate ? ` – ${fmt(r.endDate)}` : ""}
                      </span>
                      <LeaveStatusPill status={r.status} />
                    </div>
                    <p className="mt-1 text-[11px] text-t2">{r.reason}</p>
                    {r.status === "rejected" && r.reviewNote && (
                      <p className="mt-1 text-[10px] text-[#F87171]">
                        Admin note: {r.reviewNote}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function LeaveStatusPill({ status }: { status: LeaveRequest["status"] }) {
  const map: Record<string, { bg: string; color: string }> = {
    pending: { bg: "rgba(245,158,11,.18)", color: "#FCD34D" },
    approved: { bg: "rgba(74,222,128,.18)", color: "#4ADE80" },
    rejected: { bg: "rgba(239,68,68,.18)", color: "#F87171" },
  };
  const s = map[status];
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase"
      style={{ background: s.bg, color: s.color }}
    >
      {status}
    </span>
  );
}
