"use client";

import { useState } from "react";
import { X } from "lucide-react";

const SESSION_ISSUES = [
  { id: "audio", icon: "🎙", label: "Audio drops", sub: "students couldn't hear" },
  { id: "chat", icon: "💬", label: "Chat noisy", sub: "off-topic messages" },
  { id: "pace", icon: "⏱", label: "Pacing off", sub: "too fast or too slow" },
  { id: "tech", icon: "🛠", label: "Tech issues", sub: "videos / screen share" },
  { id: "engagement", icon: "🙋", label: "Low engagement", sub: "few hands / answers" },
  { id: "content", icon: "📚", label: "Content gap", sub: "materials unclear" },
];

export function EndSummaryModal({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (args: { remarks: string; issues: string[]; impact: string }) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [impact, setImpact] = useState<"low" | "med" | "high" | null>(null);
  const [remarks, setRemarks] = useState("");

  if (!open) return null;

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <div
      className="fixed inset-0 z-[500] overflow-y-auto p-6"
      style={{ background: "rgba(15,14,12,.7)" }}
      onClick={onClose}
    >
      <div
        className="mx-auto w-full max-w-[960px] overflow-hidden rounded-[16px]"
        style={{
          background: "#F2F0EC",
          boxShadow: "0 32px 100px rgba(0,0,0,.4)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex flex-shrink-0 items-center gap-3.5 px-5 py-4"
          style={{ background: "#1E1C18" }}
        >
          <div className="rounded-md border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.6px] text-white/60">
            End of Class
          </div>
          <div className="flex-1">
            <p className="text-[15px] font-bold tracking-[-.2px] text-white">
              Session wrap-up
            </p>
            <p className="mt-0.5 text-[11px] text-white/40">
              Review, reflect, and finalise remarks before ending.
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-white/10 text-white/50 hover:bg-white/20 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* KPIs */}
        <div className="flex flex-wrap bg-white">
          <SumKpi val="45:00" label="Duration" sub="actual" />
          <SumKpi val="13" label="Students" sub="attended" />
          <SumKpi val="3" label="Questions" sub="polled" />
          <SumKpi val="78%" label="Comp." sub="understood" />
          <SumKpi val="82%" label="Participation" sub="hands + answers" />
        </div>

        {/* Body */}
        <div className="grid grid-cols-2 gap-3 p-4">
          {/* Session issues */}
          <Card title="Session issues" icon="⚠️" full>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
              {SESSION_ISSUES.map((iss) => {
                const on = selected.has(iss.id);
                return (
                  <button
                    key={iss.id}
                    onClick={() => toggle(iss.id)}
                    className={`flex items-center gap-2 rounded-[9px] border-[1.5px] px-2.5 py-2 text-left transition-colors ${
                      on ? "border-red bg-rbg" : "border-bd bg-panel hover:border-bd2"
                    }`}
                  >
                    <span
                      className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md border text-[13px]"
                      style={{
                        background: on ? "var(--rbg)" : "white",
                        borderColor: on ? "var(--rbd)" : "var(--bd)",
                      }}
                    >
                      {iss.icon}
                    </span>
                    <div className="flex-1">
                      <p
                        className={`text-[11px] ${
                          on ? "font-semibold text-rt" : "font-medium text-t"
                        }`}
                      >
                        {iss.label}
                      </p>
                      <p className="text-[9px] text-t3">{iss.sub}</p>
                    </div>
                    {on && (
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-red text-[9px] text-white">
                        ✓
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {selected.size > 0 && (
              <div className="mt-3 flex items-center gap-2.5 border-t border-bd pt-3">
                <span className="flex-shrink-0 text-[11px] font-medium text-t2">
                  Overall impact
                </span>
                <div className="flex gap-1.5">
                  {(
                    [
                      { id: "low" as const, label: "Low", cls: "bg-gbg text-gt border-gbd" },
                      { id: "med" as const, label: "Medium", cls: "bg-abg text-at border-abd" },
                      { id: "high" as const, label: "High", cls: "bg-rbg text-rt border-rbd" },
                    ]
                  ).map((o) => (
                    <button
                      key={o.id}
                      onClick={() => setImpact(o.id)}
                      className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold transition-all ${
                        impact === o.id
                          ? o.cls + " ring-2 ring-offset-1"
                          : "border-bd2 bg-surf text-t2 hover:bg-panel"
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* Remarks */}
          <Card title="Teacher remarks" icon="📝" full>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="What went well? What would you change next session?"
              className="min-h-[90px] w-full resize-y rounded-lg border border-bd2 bg-panel px-3 py-2.5 text-[12px] leading-[1.6] text-t outline-none focus:border-blue"
            />
          </Card>
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-bd bg-white px-4 py-3">
          <span className="text-[11px] text-t3">
            Remarks are saved with this class and visible on the Reports page.
          </span>
          <div className="flex gap-1.5">
            <button
              onClick={onClose}
              className="rounded-[7px] border border-bd2 bg-white px-4 py-1.5 text-[11px] font-medium text-t2 hover:bg-panel"
            >
              Cancel
            </button>
            <button
              onClick={() =>
                onConfirm({
                  remarks,
                  issues: [...selected],
                  impact: impact ?? "",
                })
              }
              className="rounded-[7px] bg-[#1E1C18] px-4 py-1.5 text-[11px] font-medium text-white hover:bg-[#333]"
            >
              End class & save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SumKpi({ val, label, sub }: { val: string; label: string; sub: string }) {
  return (
    <div className="flex flex-1 flex-col gap-0.5 border-r border-bd px-5 py-4 last:border-r-0">
      <span className="text-[26px] font-bold leading-none tracking-[-.5px]">{val}</span>
      <span className="mt-1 text-[10px] font-medium uppercase tracking-[.5px] text-t3">
        {label}
      </span>
      <span className="mt-0.5 text-[11px] text-t2">{sub}</span>
    </div>
  );
}

function Card({
  title,
  icon,
  children,
  full,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div
      className={`overflow-hidden rounded-[12px] border border-bd bg-white ${
        full ? "col-span-2" : ""
      }`}
    >
      <div className="flex items-center gap-2.5 border-b border-bd bg-white px-3.5 py-2.5">
        <span className="w-6 text-center text-[14px]">{icon}</span>
        <span className="flex-1 text-[12px] font-semibold">{title}</span>
      </div>
      <div className="p-3.5">{children}</div>
    </div>
  );
}
