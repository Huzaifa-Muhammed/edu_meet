"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, Loader2, Check, X } from "lucide-react";
import api from "@/lib/api/client";
import { getFirebaseAuth } from "@/lib/firebase/client";
import type { ClassQuestion } from "@/server/services/class-questions.service";

export type RaisedHand = { uid: string; name: string; at: number };

export type ActiveReaction = {
  uid: string;
  name: string;
  type: "ok" | "confused";
  at: number;
};

export type RejoinRequest = {
  id: string;
  uid: string;
  name: string;
  email?: string | null;
  requestedAt: string;
  status: "pending" | "approved" | "denied";
};

type Chip = {
  key: string;
  tone: "red" | "amber" | "green" | "purple" | "blue";
  icon: string;
  who?: string;
  msg: string;
  actions?: {
    approveLabel?: string;
    denyLabel?: string;
    onApprove: () => void;
    onDeny: () => void;
    busy?: boolean;
  };
};

const OVERDUE_MS = 2 * 60 * 1000; // 2 min pending = overdue

/** Live AI monitor strip. Aggregates real signals from the room (raised hands,
 *  pending student questions) and optionally runs a Groq summary on demand. */
export function AiHighlightsStrip({
  classroomId,
  hands,
  reactions = [],
  rejoinRequests = [],
  onApproveRejoin,
  onDenyRejoin,
  rejoinBusy = false,
  participantCount,
}: {
  classroomId: string;
  hands: RaisedHand[];
  reactions?: ActiveReaction[];
  rejoinRequests?: RejoinRequest[];
  onApproveRejoin?: (uid: string) => void;
  onDenyRejoin?: (uid: string) => void;
  rejoinBusy?: boolean;
  participantCount: number;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [aiChip, setAiChip] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  // Tick every 20s so "overdue" chips re-evaluate.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 20_000);
    return () => clearInterval(t);
  }, []);

  const { data: questions = [] } = useQuery({
    queryKey: ["class-questions", classroomId],
    queryFn: () =>
      api.get(
        `/classrooms/${classroomId}/questions`,
      ) as unknown as Promise<ClassQuestion[]>,
    enabled: !!classroomId,
    refetchInterval: 15_000,
  });

  const pending = useMemo(
    () => questions.filter((q) => q.status === "pending"),
    [questions],
  );
  const overdue = useMemo(
    () =>
      pending.filter((q) => now - new Date(q.createdAt).getTime() > OVERDUE_MS),
    [pending, now],
  );

  const confused = useMemo(
    () => reactions.filter((r) => r.type === "confused"),
    [reactions],
  );
  const gotIt = useMemo(
    () => reactions.filter((r) => r.type === "ok"),
    [reactions],
  );

  const chips: Chip[] = useMemo(() => {
    const out: Chip[] = [];

    // Rejoin requests come first — they need a teacher decision and the
    // student is sitting on a "waiting for approval" screen.
    for (const r of rejoinRequests) {
      out.push({
        key: `rejoin-${r.uid}`,
        tone: "purple",
        icon: "🚪",
        who: r.name,
        msg: "asks to rejoin (was removed earlier)",
        actions: onApproveRejoin && onDenyRejoin
          ? {
              approveLabel: "Let in",
              denyLabel: "Keep out",
              onApprove: () => onApproveRejoin(r.uid),
              onDeny: () => onDenyRejoin(r.uid),
              busy: rejoinBusy,
            }
          : undefined,
      });
    }

    for (const q of overdue) {
      out.push({
        key: `overdue-${q.id}`,
        tone: "red",
        icon: "⏱️",
        who: q.askedByName,
        msg: `awaiting answer — "${truncate(q.text, 60)}"`,
      });
    }

    for (const r of confused) {
      out.push({
        key: `confused-${r.uid}`,
        tone: "red",
        icon: "😕",
        who: r.name,
        msg: "is confused",
      });
    }

    for (const h of hands) {
      out.push({
        key: `hand-${h.uid}`,
        tone: "amber",
        icon: "🙋",
        who: h.name,
        msg: "hand raised",
      });
    }

    const fresh = pending.filter(
      (q) => !overdue.some((o) => o.id === q.id),
    );
    for (const q of fresh) {
      out.push({
        key: `q-${q.id}`,
        tone: "blue",
        icon: "❓",
        who: q.askedByName,
        msg: `asked: "${truncate(q.text, 60)}"`,
      });
    }

    for (const r of gotIt) {
      out.push({
        key: `gotit-${r.uid}`,
        tone: "green",
        icon: "👍",
        who: r.name,
        msg: "got it",
      });
    }

    return out;
  }, [hands, pending, overdue, confused, gotIt, rejoinRequests, onApproveRejoin, onDenyRejoin, rejoinBusy]);

  async function runAiSummary() {
    setAiLoading(true);
    try {
      const state = `${participantCount} participants, ${hands.length} hand(s) raised, ${confused.length} student(s) confused, ${gotIt.length} signaling "got it", ${pending.length} pending student question(s) (${overdue.length} overdue >2min), ${rejoinRequests.length} previously-removed student(s) asking to rejoin.`;
      const topQs = pending.slice(0, 5).map((q) => `- ${q.askedByName}: "${q.text}"`).join("\n");
      const token = await getFirebaseAuth().currentUser?.getIdToken();
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          messages: [
            {
              role: "user",
              content: `Teacher is running a live class. Current state:
${state}
${topQs ? `Pending questions:\n${topQs}` : ""}

Reply with ONE short sentence (under 20 words) telling the teacher what to act on first. Be direct. No preamble.`,
            },
          ],
          temperature: 0.3,
        }),
      });
      const data = (await res.json()) as { ok: boolean; data?: { text: string } };
      setAiChip(data.data?.text?.trim().replace(/^["']|["']$/g, "") ?? null);
    } catch {
      setAiChip(null);
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <div
      className="flex flex-shrink-0 flex-col overflow-hidden border-t border-bd bg-surf"
      style={{ height: 180 }}
    >
      <div className="flex flex-shrink-0 items-center gap-2 border-b border-bd px-3 py-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-[.5px] text-t3">
          🤖 AI Highlights
        </span>
        <span className="text-[10px] text-t3">
          {chips.length === 0
            ? "all clear"
            : `${chips.length} signal${chips.length === 1 ? "" : "s"}`}
        </span>
        <button
          onClick={runAiSummary}
          disabled={aiLoading}
          className="ml-auto flex items-center gap-1 rounded-md border border-pbd bg-pbg px-2 py-0.5 text-[10px] font-medium text-pt hover:bg-purple-100 disabled:opacity-50"
        >
          {aiLoading ? (
            <Loader2 className="h-2.5 w-2.5 animate-spin" />
          ) : (
            <Sparkles className="h-2.5 w-2.5" />
          )}
          {aiLoading ? "Thinking…" : "Ask AI"}
        </button>
      </div>
      <div className="flex flex-1 flex-wrap content-start gap-2 overflow-y-auto px-3 py-2">
        {aiChip && (
          <AiSuggestionChip text={aiChip} onDismiss={() => setAiChip(null)} />
        )}
        {chips.length === 0 && !aiChip ? (
          <p className="w-full py-6 text-center text-[11px] text-t3">
            No live signals yet. Raised hands, new questions, and overdue questions
            will show up here.
          </p>
        ) : (
          chips.map((c) => <HighlightChip key={c.key} chip={c} />)
        )}
      </div>
    </div>
  );
}

function HighlightChip({ chip }: { chip: Chip }) {
  const tones: Record<
    Chip["tone"],
    { bg: string; color: string; border: string }
  > = {
    red: { bg: "var(--rbg)", color: "var(--rt)", border: "var(--rbd)" },
    amber: { bg: "var(--abg)", color: "var(--at)", border: "var(--abd)" },
    green: { bg: "var(--gbg)", color: "var(--gt)", border: "var(--gbd)" },
    purple: { bg: "var(--pbg)", color: "var(--pt)", border: "var(--pbd)" },
    blue: { bg: "var(--bbg)", color: "var(--bt)", border: "var(--bbd)" },
  };
  const t = tones[chip.tone];
  return (
    <div
      className="flex flex-shrink-0 items-center gap-2 rounded-lg border px-2.5 py-1 text-[11px] leading-[1.4]"
      style={{ background: t.bg, color: t.color, borderColor: t.border }}
    >
      <span>
        {chip.icon} {chip.who && <strong>{chip.who}</strong>} {chip.msg}
      </span>
      {chip.actions && (
        <span className="flex items-center gap-1">
          <button
            onClick={chip.actions.onApprove}
            disabled={chip.actions.busy}
            className="inline-flex items-center gap-1 rounded-full bg-green-600 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-green-700 disabled:opacity-50"
          >
            <Check className="h-2.5 w-2.5" />
            {chip.actions.approveLabel ?? "Approve"}
          </button>
          <button
            onClick={chip.actions.onDeny}
            disabled={chip.actions.busy}
            className="inline-flex items-center gap-1 rounded-full border border-red-300 bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
          >
            <X className="h-2.5 w-2.5" />
            {chip.actions.denyLabel ?? "Deny"}
          </button>
        </span>
      )}
    </div>
  );
}

function AiSuggestionChip({
  text,
  onDismiss,
}: {
  text: string;
  onDismiss: () => void;
}) {
  return (
    <div
      className="flex w-full items-start gap-2 rounded-lg border px-3 py-2 text-[11px] leading-[1.5]"
      style={{
        background: "var(--pbg)",
        color: "var(--pt)",
        borderColor: "var(--pbd)",
      }}
    >
      <Sparkles className="mt-0.5 h-3 w-3 flex-shrink-0" />
      <span className="flex-1">
        <strong>AI suggestion:</strong> {text}
      </span>
      <button
        onClick={onDismiss}
        className="flex-shrink-0 rounded px-1 text-[11px] opacity-60 hover:opacity-100"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
