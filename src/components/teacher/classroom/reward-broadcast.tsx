"use client";

import { useEffect, useState } from "react";
import type { RewardKind } from "./reward-modal";

export type BroadcastPayload = {
  id: string;
  name: string;
  initials: string;
  avBg: string;
  rewardEmoji: string;
  rewardLabel: string;
  note: string;
};

/** Center-of-stage toast shown when teacher awards a reward.
 *  Auto-dismisses after ~3.5s. */
export function RewardBroadcast({
  payload,
  onDone,
}: {
  payload: BroadcastPayload | null;
  onDone: () => void;
}) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (!payload) return;
    setShown(true);
    const t = setTimeout(() => setShown(false), 3200);
    const t2 = setTimeout(onDone, 3500);
    return () => {
      clearTimeout(t);
      clearTimeout(t2);
    };
  }, [payload, onDone]);

  if (!payload) return null;

  return (
    <div
      className={`pointer-events-none absolute inset-0 z-[30] flex items-center justify-center transition-opacity ${
        shown ? "opacity-100" : "opacity-0"
      }`}
      style={{ background: "rgba(0,0,0,.35)" }}
    >
      {/* Confetti pieces */}
      <div className="absolute inset-0 overflow-hidden">
        {Array.from({ length: 40 }).map((_, i) => (
          <span
            key={i}
            className="absolute h-2 w-2 rounded-sm"
            style={{
              left: `${(i * 11 + 5) % 100}%`,
              top: "-10px",
              background: ["#FACC15", "#F87171", "#4ADE80", "#60A5FA", "#E879F9"][i % 5],
              animation: `confetti-fall ${1.8 + (i % 5) * 0.25}s ease-in ${(i % 10) * 0.05}s forwards`,
              transform: `rotate(${(i * 37) % 360}deg)`,
            }}
          />
        ))}
      </div>

      <div
        className={`flex min-w-[260px] max-w-[360px] flex-col items-center gap-2 rounded-[14px] border border-yellow-300/40 px-6 py-5 text-center backdrop-blur transition-transform duration-500 ${
          shown ? "scale-100" : "scale-90"
        }`}
        style={{
          background: "linear-gradient(135deg, rgba(15,23,42,.92), rgba(30,27,75,.9))",
          boxShadow: "0 20px 60px rgba(0,0,0,.4)",
        }}
      >
        <div
          className="flex h-14 w-14 items-center justify-center rounded-full text-[15px] font-bold text-white"
          style={{ background: payload.avBg }}
        >
          {payload.initials}
        </div>
        <div className="text-[15px] font-bold text-white">{payload.name}</div>
        <div className="flex items-center gap-2 rounded-full bg-yellow-400/25 px-3 py-1 text-[14px] font-semibold text-yellow-100">
          <span className="text-[22px]">{payload.rewardEmoji}</span>
          {payload.rewardLabel}
        </div>
        {payload.note && (
          <p className="mt-1 text-[11px] leading-[1.5] text-white/70">“{payload.note}”</p>
        )}
      </div>

      <style jsx>{`
        @keyframes confetti-fall {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(110vh) rotate(720deg);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}

export function rewardColor(kind: RewardKind): string {
  const m: Record<RewardKind, string> = {
    star: "#F59E0B",
    mvp: "#D97706",
    helper: "#2563EB",
    streak: "#DC2626",
    "quiz-ace": "#7C3AED",
  };
  return m[kind];
}
