"use client";

import { useMemo } from "react";
import { useMeeting, usePubSub } from "@videosdk.live/react-sdk";
import { X } from "lucide-react";

/** Live reactions students emit — one of "ok" | "unsure" | "confused" per topic. */
export type Reaction = {
  pId: string;
  topic: string;
  kind: "ok" | "unsure" | "confused";
  ts: number;
};

const TOPICS = [
  { name: "What is an equation?", diff: "easy" as const },
  { name: "Solving linear equations", diff: "medium" as const },
  { name: "Types of solutions", diff: "medium" as const },
  { name: "Word problems", diff: "hard" as const },
];

type Totals = { ok: number; unsure: number; confused: number };

export function ComprehensionModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { participants } = useMeeting();
  const { messages } = usePubSub("REACTION");

  // Latest reaction per student+topic wins
  const perTopic = useMemo(() => {
    const last = new Map<string, Reaction>();
    for (const m of messages) {
      try {
        const r = JSON.parse(m.message as unknown as string) as Reaction;
        last.set(`${r.pId}:${r.topic}`, r);
      } catch {
        // skip
      }
    }
    const byTopic = new Map<string, Totals>();
    for (const r of last.values()) {
      const t = byTopic.get(r.topic) ?? { ok: 0, unsure: 0, confused: 0 };
      t[r.kind] += 1;
      byTopic.set(r.topic, t);
    }
    return byTopic;
  }, [messages.length]);

  // Students needing follow-up: anyone with "confused" reaction
  const followups = useMemo(() => {
    const last = new Map<string, Reaction>();
    for (const m of messages) {
      try {
        const r = JSON.parse(m.message as unknown as string) as Reaction;
        last.set(`${r.pId}:${r.topic}`, r);
      } catch {
        // skip
      }
    }
    const byStudent = new Map<
      string,
      { pId: string; name: string; confused: number; unsure: number }
    >();
    for (const r of last.values()) {
      if (r.kind === "ok") continue;
      const p = participants.get(r.pId) as unknown as { displayName?: string } | undefined;
      const name = p?.displayName ?? "Student";
      const cur = byStudent.get(r.pId) ?? { pId: r.pId, name, confused: 0, unsure: 0 };
      if (r.kind === "confused") cur.confused += 1;
      if (r.kind === "unsure") cur.unsure += 1;
      byStudent.set(r.pId, cur);
    }
    return [...byStudent.values()]
      .filter((s) => s.confused > 0 || s.unsure > 1)
      .sort((a, b) => b.confused - a.confused || b.unsure - a.unsure)
      .slice(0, 6);
  }, [messages.length, participants]);

  if (!open) return null;

  // Overall totals
  const overall: Totals = { ok: 0, unsure: 0, confused: 0 };
  for (const t of perTopic.values()) {
    overall.ok += t.ok;
    overall.unsure += t.unsure;
    overall.confused += t.confused;
  }
  const tot = overall.ok + overall.unsure + overall.confused || 1;
  const compPct = Math.round((overall.ok / tot) * 100);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center overflow-y-auto p-6"
      style={{ background: "rgba(15,14,12,.7)" }}
      onClick={onClose}
    >
      <div
        className="mx-auto w-full max-w-[820px] overflow-hidden rounded-[14px] bg-white"
        style={{ boxShadow: "0 32px 100px rgba(0,0,0,.4)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 bg-[#1E1C18] px-5 py-3.5">
          <div className="rounded-md bg-white/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.6px] text-white/60">
            LIVE
          </div>
          <div className="flex-1">
            <p className="text-[14px] font-bold text-white">Class Comprehension</p>
            <p className="mt-0.5 text-[11px] text-white/40">
              {participants.size} in class · updates from live reactions
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-white/10 text-white/60 hover:bg-white/20 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* KPIs */}
        <div className="flex border-b border-bd bg-white">
          <Kpi val={`${compPct}%`} label="Comprehension" sub="of signals" />
          <Kpi val={String(overall.ok)} label="Understood" sub="green signals" />
          <Kpi val={String(overall.unsure)} label="Unsure" sub="amber signals" />
          <Kpi val={String(overall.confused)} label="Confused" sub="red signals" />
        </div>

        {/* Body grid */}
        <div className="grid grid-cols-2 gap-3 p-4" style={{ background: "#F2F0EC" }}>
          {/* Topic breakdown */}
          <div className="col-span-2 rounded-[12px] border border-bd bg-white">
            <div className="flex items-center gap-2 border-b border-bd px-3.5 py-2.5">
              <span className="w-6 text-center text-[14px]">📊</span>
              <span className="flex-1 text-[12px] font-semibold">Topic breakdown</span>
            </div>
            <div className="p-3.5">
              <div className="mb-3 flex flex-wrap gap-3.5">
                <Legend color="var(--green)" label="Understood" />
                <Legend color="var(--amber)" label="Unsure" />
                <Legend color="var(--red)" label="Confused" />
              </div>
              {TOPICS.map((t) => {
                const totals = perTopic.get(t.name) ?? { ok: 0, unsure: 0, confused: 0 };
                return <TopicRow key={t.name} name={t.name} diff={t.diff} totals={totals} />;
              })}
            </div>
          </div>

          {/* Follow-ups */}
          <div className="rounded-[12px] border border-bd bg-white">
            <div className="flex items-center gap-2 border-b border-bd px-3.5 py-2.5">
              <span className="w-6 text-center text-[14px]">👀</span>
              <span className="flex-1 text-[12px] font-semibold">Students needing follow-up</span>
              <span className="rounded-full bg-rbg px-2 py-0.5 text-[9px] font-bold uppercase tracking-[.3px] text-rt">
                {followups.length}
              </span>
            </div>
            <div className="space-y-1.5 p-3">
              {followups.length === 0 ? (
                <p className="py-5 text-center text-[11px] text-t3">
                  Nobody flagged yet. Students signal directly from their side.
                </p>
              ) : (
                followups.map((f) => <FollowRow key={f.pId} f={f} />)
              )}
            </div>
          </div>

          {/* Next step suggestions */}
          <div className="rounded-[12px] border border-bd bg-white">
            <div className="flex items-center gap-2 border-b border-bd px-3.5 py-2.5">
              <span className="w-6 text-center text-[14px]">💡</span>
              <span className="flex-1 text-[12px] font-semibold">Suggested next steps</span>
            </div>
            <div className="space-y-1.5 p-3">
              {overall.confused > 0 ? (
                <Suggestion
                  icon="🎯"
                  t="Re-teach the topic with most red signals"
                  d={`${overall.confused} confused signals — worth a quick recap or worked example.`}
                />
              ) : (
                <Suggestion
                  icon="✅"
                  t="Class is tracking well"
                  d="No red signals. You can continue to the next subtopic."
                />
              )}
              {overall.unsure > overall.ok / 2 && (
                <Suggestion
                  icon="⏸"
                  t="Slow pacing a touch"
                  d="Amber signals are stacking up — spend a minute on a quick check."
                />
              )}
              {followups.length > 0 && (
                <Suggestion
                  icon="📝"
                  t={`Check in with ${followups[0].name}`}
                  d="They flagged confusion on at least one subtopic."
                />
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-bd bg-white px-4 py-2.5">
          <span className="text-[11px] text-t3">
            Signals come from students' live reactions — updates are pushed via the meeting channel.
          </span>
          <div className="flex gap-1.5">
            <button
              onClick={onClose}
              className="rounded-[7px] border border-bd2 bg-white px-3 py-1.5 text-[11px] font-medium text-t2 hover:bg-panel"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Kpi({ val, label, sub }: { val: string; label: string; sub: string }) {
  return (
    <div className="flex flex-1 flex-col border-r border-bd px-4 py-3.5 last:border-r-0">
      <span className="text-[24px] font-bold leading-none tracking-[-.5px]">{val}</span>
      <span className="mt-1.5 text-[10px] font-medium uppercase tracking-[.5px] text-t3">{label}</span>
      <span className="mt-0.5 text-[11px] text-t2">{sub}</span>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[10px] font-medium text-t2">
      <span className="h-[5px] w-7 rounded" style={{ background: color }} />
      {label}
    </div>
  );
}

function TopicRow({
  name,
  diff,
  totals,
}: {
  name: string;
  diff: "easy" | "medium" | "hard";
  totals: Totals;
}) {
  const total = totals.ok + totals.unsure + totals.confused;
  const diffTone = {
    easy: "bg-[#F0FDF4] text-[#15803D]",
    medium: "bg-[#FFFBEB] text-[#92400E]",
    hard: "bg-[#FEF2F2] text-[#991B1B]",
  }[diff];

  const gapPct = total ? Math.round(((totals.confused + totals.unsure) / total) * 100) : 0;
  const gapCls =
    gapPct > 25
      ? "bg-[#FEF2F2] text-[#991B1B]"
      : gapPct > 10
        ? "bg-[#FFFBEB] text-[#92400E]"
        : "bg-[#F0FDF4] text-[#15803D]";

  return (
    <div className="mb-3 last:mb-0">
      <div className="mb-1.5 flex items-center gap-2">
        <span className="flex-1 text-[11px] font-semibold text-t">{name}</span>
        <span
          className={`rounded px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[.3px] ${diffTone}`}
        >
          {diff}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex flex-1 items-center gap-2">
          <Num n={totals.ok} label="OK" color="var(--green)" />
          <Div />
          <Num n={totals.unsure} label="?" color="var(--amber)" />
          <Div />
          <Num n={totals.confused} label="✗" color="var(--red)" />
        </div>
        <div className="flex flex-shrink-0 items-center gap-1.5">
          <span className="text-[9px] text-t3">Gap</span>
          <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${gapCls}`}>
            {total ? `${gapPct}%` : "—"}
          </span>
        </div>
      </div>
    </div>
  );
}

function Num({ n, label, color }: { n: number; label: string; color: string }) {
  return (
    <div className="flex min-w-[52px] flex-col items-center gap-0.5">
      <span
        className="font-mono text-[20px] font-extrabold leading-none tracking-[-1px]"
        style={{ color }}
      >
        {n}
      </span>
      <span className="text-[9px] font-medium uppercase tracking-[.3px] text-t3">{label}</span>
    </div>
  );
}

function Div() {
  return <div className="mx-1 h-7 w-px bg-bd" />;
}

function FollowRow({
  f,
}: {
  f: { pId: string; name: string; confused: number; unsure: number };
}) {
  const tone = f.confused > 0 ? "border-rbd bg-rbg" : "border-abd bg-abg";
  const tag = f.confused > 0 ? "bg-red text-white" : "bg-amber text-white";
  return (
    <div className={`flex items-center gap-2 rounded-[8px] border px-2.5 py-1.5 ${tone}`}>
      <div
        className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white"
        style={{ background: f.confused > 0 ? "#DC2626" : "#D97706" }}
      >
        {f.name.slice(0, 2).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold text-t">{f.name}</p>
        <p className="truncate text-[10px] text-t3">
          {f.confused > 0 && <>{f.confused} confused</>}
          {f.confused > 0 && f.unsure > 0 && <> · </>}
          {f.unsure > 0 && <>{f.unsure} unsure</>}
        </p>
      </div>
      <span className={`rounded px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[.3px] ${tag}`}>
        Follow up
      </span>
    </div>
  );
}

function Suggestion({ icon, t, d }: { icon: string; t: string; d: string }) {
  return (
    <div className="flex cursor-pointer items-center gap-2 rounded-[8px] border border-bd bg-panel px-2.5 py-2 transition-colors hover:bg-panel2">
      <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-surf text-[13px]">
        {icon}
      </div>
      <div className="flex-1">
        <p className="text-[11px] font-semibold">{t}</p>
        <p className="text-[10px] text-t3">{d}</p>
      </div>
    </div>
  );
}
