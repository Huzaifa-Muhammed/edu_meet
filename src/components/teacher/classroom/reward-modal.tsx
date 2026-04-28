"use client";

import { useState } from "react";
import { X } from "lucide-react";

export type RewardKind = "star" | "mvp" | "helper" | "streak" | "quiz-ace";

type RewardDef = {
  kind: RewardKind;
  emoji: string;
  label: string;
  pts: number;
  bg: string;
  color: string;
  border: string;
};

export const REWARDS: RewardDef[] = [
  { kind: "star", emoji: "⭐", label: "Star", pts: 5, bg: "#FFF7ED", color: "#C2410C", border: "#FED7AA" },
  { kind: "mvp", emoji: "🏆", label: "MVP", pts: 15, bg: "#FEF3C7", color: "#92400E", border: "#FDE68A" },
  { kind: "helper", emoji: "🤝", label: "Helper", pts: 10, bg: "#DBEAFE", color: "#1D4ED8", border: "#BFDBFE" },
  { kind: "streak", emoji: "🔥", label: "Streak", pts: 8, bg: "#FEE2E2", color: "#B91C1C", border: "#FECACA" },
  { kind: "quiz-ace", emoji: "🎯", label: "Quiz Ace", pts: 20, bg: "#F5F3FF", color: "#6D28D9", border: "#DDD6FE" },
];

export function RewardModal({
  open,
  onClose,
  onAward,
  students,
  defaultStudentId,
}: {
  open: boolean;
  onClose: () => void;
  onAward: (args: { studentId: string; reward: RewardDef; note: string }) => void;
  students: { id: string; name: string }[];
  defaultStudentId?: string;
}) {
  const [studentId, setStudentId] = useState(defaultStudentId ?? students[0]?.id ?? "");
  const [picked, setPicked] = useState<RewardDef>(REWARDS[0]);
  const [note, setNote] = useState("");

  if (!open) return null;

  const award = () => {
    if (!studentId) return;
    onAward({ studentId, reward: picked, note });
    setNote("");
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,.3)" }}
      onClick={onClose}
    >
      <div
        className="w-[420px] rounded-[13px] bg-white p-5"
        style={{ boxShadow: "0 20px 60px rgba(0,0,0,.15)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[13px] font-semibold">Give a reward</h3>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-t3 hover:bg-panel hover:text-t"
            aria-label="Close"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <Field label="Student">
          <select
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            className="w-full rounded-[7px] border border-bd2 bg-panel px-2.5 py-1.5 text-[12px] outline-none"
          >
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Reward">
          <div className="grid grid-cols-2 gap-1.5">
            {REWARDS.map((r) => (
              <button
                key={r.kind}
                onClick={() => setPicked(r)}
                className={`flex items-center gap-2 rounded-lg border-[1.5px] px-2.5 py-1.5 text-left transition-colors ${
                  picked.kind === r.kind ? "border-acc bg-accbg" : "border-bd bg-surf hover:bg-panel"
                }`}
              >
                <span className="text-[18px]">{r.emoji}</span>
                <div className="flex-1">
                  <p className="text-[11px] font-semibold">{r.label}</p>
                  <p className="text-[10px] text-t3">+{r.pts} pts</p>
                </div>
              </button>
            ))}
          </div>
        </Field>

        <Field label="Message (optional)">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Great work on Q3!"
            className="w-full resize-none rounded-[7px] border border-bd2 bg-panel px-2.5 py-1.5 text-[12px] outline-none"
          />
        </Field>

        <div className="mt-3 flex justify-end gap-1.5">
          <button
            onClick={onClose}
            className="rounded-[7px] border border-bd2 bg-transparent px-3 py-1.5 text-[11px] font-medium text-t2 hover:bg-panel"
          >
            Cancel
          </button>
          <button
            onClick={award}
            disabled={!studentId}
            className="rounded-[7px] bg-acc px-3 py-1.5 text-[11px] font-medium text-white disabled:opacity-40"
          >
            Award
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-2.5">
      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[.5px] text-t2">
        {label}
      </label>
      {children}
    </div>
  );
}
