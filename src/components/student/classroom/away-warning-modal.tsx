"use client";

import { useEffect } from "react";

export function AwayWarningModal({
  open,
  durationMs,
  onAcknowledge,
}: {
  open: boolean;
  durationMs: number;
  onAcknowledge: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter") onAcknowledge();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onAcknowledge]);

  if (!open) return null;

  const seconds = Math.max(1, Math.round(durationMs / 1000));
  const phrase =
    seconds < 60
      ? `${seconds} second${seconds === 1 ? "" : "s"}`
      : `${Math.round(seconds / 60)} minute${Math.round(seconds / 60) === 1 ? "" : "s"}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="away-warning-title"
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: "rgba(2,6,18,0.72)", backdropFilter: "blur(4px)" }}
    >
      <div
        className="flex w-full max-w-md flex-col gap-4 rounded-2xl p-5 text-white"
        style={{
          background: "linear-gradient(135deg, rgba(20,16,40,0.95), rgba(8,12,28,0.95))",
          border: "1px solid rgba(250,204,21,0.35)",
          boxShadow: "0 24px 60px rgba(0,0,0,0.55)",
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-lg"
            style={{
              background: "rgba(250,204,21,0.18)",
              border: "1px solid rgba(250,204,21,0.45)",
            }}
          >
            ⚠️
          </div>
          <div>
            <h2 id="away-warning-title" className="text-base font-semibold">
              You stepped away from class
            </h2>
            <p className="mt-0.5 text-[11px] text-white/55">
              Detected when you switched tabs or minimized the window
            </p>
          </div>
        </div>

        <div
          className="rounded-xl px-3 py-2.5 text-[12px] leading-snug text-white/80"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          You were away for{" "}
          <strong className="text-white" style={{ color: "#FACC15" }}>
            {phrase}
          </strong>
          . Repeated absences are visible to your teacher and may affect your
          class participation grade. Please stay on this tab during the lesson.
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            onClick={onAcknowledge}
            className="rounded-full px-4 py-1.5 text-[12px] font-semibold"
            style={{
              background: "linear-gradient(135deg,#FACC15,#F59E0B)",
              color: "#0F172A",
            }}
          >
            Got it — I&apos;ll stay here
          </button>
        </div>
      </div>
    </div>
  );
}
