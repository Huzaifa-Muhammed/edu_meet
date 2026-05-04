"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, LifeBuoy, Clock } from "lucide-react";
import api from "@/lib/api/client";
import type { SupportTicket } from "@/server/services/support.service";

type TicketWithReporter = SupportTicket & {
  reporterName: string;
  reporterEmail: string;
  reporterRole: string;
};

type Filter = "open" | "resolved" | "all";

export default function AdminReportsPage() {
  const [filter, setFilter] = useState<Filter>("open");
  const queryClient = useQueryClient();

  const ticketsQ = useQuery({
    queryKey: ["admin", "reports", filter],
    queryFn: () =>
      api.get(
        filter === "all" ? "/admin/reports" : `/admin/reports?status=${filter}`,
      ) as Promise<TicketWithReporter[]>,
  });

  const resolveMutation = useMutation({
    mutationFn: ({
      id,
      status,
    }: {
      id: string;
      status: "open" | "resolved";
    }) =>
      api.patch(`/admin/reports/${id}`, { status }) as Promise<unknown>,
    onSuccess: (_d, vars) => {
      toast.success(
        vars.status === "resolved" ? "Marked as resolved" : "Reopened",
      );
      queryClient.invalidateQueries({ queryKey: ["admin", "reports"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "overview"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="bg-bg p-6">
      <div className="mx-auto max-w-5xl space-y-4">
        <div>
          <h1 className="text-lg font-semibold text-t">Support reports</h1>
          <p className="text-xs text-t3">
            Tickets submitted by students from the in-app support form.
          </p>
        </div>

        <div className="flex flex-wrap gap-1 rounded-lg bg-panel p-1">
          {(["open", "resolved", "all"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-md px-3 py-1.5 text-[11px] font-medium capitalize ${
                filter === f ? "bg-surf text-t shadow-sm" : "text-t3"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {ticketsQ.isLoading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-28 animate-pulse rounded-xl border border-bd bg-panel"
              />
            ))}
          </div>
        ) : !(ticketsQ.data ?? []).length ? (
          <div className="rounded-xl border border-bd bg-surf p-10 text-center">
            <LifeBuoy className="mx-auto mb-3 h-8 w-8 text-t3" />
            <p className="text-sm font-semibold text-t">No reports here</p>
            <p className="mt-1 text-xs text-t3">
              {filter === "open"
                ? "Inbox is clear — no open student reports."
                : `No ${filter} reports.`}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {(ticketsQ.data ?? []).map((t) => (
              <ReportCard
                key={t.id}
                ticket={t}
                onResolve={() =>
                  resolveMutation.mutate({
                    id: t.id,
                    status: t.status === "open" ? "resolved" : "open",
                  })
                }
                pending={resolveMutation.isPending}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ReportCard({
  ticket,
  onResolve,
  pending,
}: {
  ticket: TicketWithReporter;
  onResolve: () => void;
  pending: boolean;
}) {
  const initials =
    ticket.reporterName
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() ?? "?";

  const priorityClass =
    ticket.priority === "high"
      ? "border-rbd bg-rbg text-rt"
      : ticket.priority === "low"
        ? "border-bd bg-panel text-t3"
        : "border-abd bg-abg text-at";

  return (
    <div className="rounded-xl border border-bd bg-surf p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-panel2 text-xs font-bold text-t">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold text-t">
              {ticket.subject}
            </p>
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] font-bold capitalize ${priorityClass}`}
            >
              {ticket.priority}
            </span>
            <span className="rounded-full border border-bd bg-panel px-2 py-0.5 text-[10px] font-bold capitalize text-t2">
              {ticket.problemType}
            </span>
            {ticket.status === "resolved" && (
              <span className="rounded-full border border-gbd bg-gbg px-2 py-0.5 text-[10px] font-bold text-gt">
                Resolved
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[11px] text-t3">
            {ticket.reporterName} · {ticket.reporterEmail}
          </p>
        </div>
        <button
          onClick={onResolve}
          disabled={pending}
          className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-colors disabled:opacity-50 ${
            ticket.status === "open"
              ? "border border-gbd bg-gbg text-gt"
              : "border border-bd bg-panel text-t2"
          }`}
        >
          <Check className="h-3 w-3" />
          {ticket.status === "open" ? "Resolve" : "Reopen"}
        </button>
      </div>

      <div className="mt-3 rounded-lg border border-bd bg-panel p-3">
        <p className="whitespace-pre-wrap text-xs text-t">{ticket.details}</p>
      </div>

      <p className="mt-3 flex items-center gap-1 text-[10px] text-t3">
        <Clock className="h-3 w-3" />
        Submitted {new Date(ticket.createdAt).toLocaleString()}
      </p>
    </div>
  );
}
