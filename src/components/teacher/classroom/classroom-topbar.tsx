"use client";

import { useEffect, useState } from "react";
import { useMeeting } from "@videosdk.live/react-sdk";

function formatTimer(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function ClassroomTopbar({
  title,
  copilotOpen,
  onToggleCopilot,
  onEnd,
  userInitial,
}: {
  title: string;
  copilotOpen: boolean;
  onToggleCopilot: () => void;
  onEnd: () => void;
  userInitial?: string;
}) {
  const { toggleMic, toggleWebcam, localMicOn, localWebcamOn } = useMeeting();
  const [secs, setSecs] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      className="flex h-[50px] flex-shrink-0 items-center gap-3 border-b border-[#0F172A] px-4"
      style={{ background: "#1E293B" }}
    >
      {/* Logo */}
      <div className="flex flex-shrink-0 items-center gap-2 text-[13px] font-semibold text-white/90">
        <div
          className="flex h-6 w-6 items-center justify-center rounded-md"
          style={{ background: "#2563EB" }}
        >
          <svg viewBox="0 0 14 14" className="h-[11px] w-[11px] fill-white">
            <rect x="1" y="1" width="5" height="5" rx="1" />
            <rect x="8" y="1" width="5" height="5" rx="1" />
            <rect x="1" y="8" width="5" height="5" rx="1" />
            <rect x="8" y="8" width="5" height="5" rx="1" />
          </svg>
        </div>
        VirtualClass
      </div>

      {/* Center: lesson label + indicators */}
      <div className="flex flex-1 items-center justify-center gap-2">
        <span className="text-xs font-medium text-white/45">{title}</span>
        <div className="flex gap-1.5">
          {/* Live */}
          <div
            className="flex items-center gap-[7px] rounded-lg border px-[11px] py-[5px]"
            style={{
              background: "#DC2626",
              borderColor: "#B91C1C",
              boxShadow: "0 0 10px rgba(220,38,38,.4)",
            }}
          >
            <span className="h-[7px] w-[7px] animate-[blink_1.4s_infinite] rounded-full bg-white" />
            <span className="text-[11px] font-bold uppercase tracking-[.7px] text-white">
              Live
            </span>
            <span className="ml-[2px] border-l border-white/25 pl-[6px] font-mono text-[11px] text-white/65">
              {formatTimer(secs)}
            </span>
          </div>

          {/* Cam */}
          <button
            onClick={() => toggleWebcam?.()}
            className={`flex items-center gap-[7px] rounded-lg border px-[11px] py-[5px] transition-colors ${
              localWebcamOn
                ? "border-amber-400/45 bg-amber-400/20"
                : "border-white/10 bg-white/[.07]"
            }`}
          >
            <span className="text-[14px]">📹</span>
            <span
              className={`text-[10px] font-semibold uppercase tracking-[.3px] ${
                localWebcamOn ? "text-amber-200" : "text-white/35"
              }`}
            >
              Camera
            </span>
          </button>

          {/* Mic */}
          <button
            onClick={() => toggleMic?.()}
            className={`flex items-center gap-[7px] rounded-lg border px-[11px] py-[5px] transition-colors ${
              localMicOn
                ? "border-green-400/40 bg-green-400/20"
                : "border-white/10 bg-white/[.07]"
            }`}
          >
            <span className="text-[14px]">🎙️</span>
            <span
              className={`text-[10px] font-semibold uppercase tracking-[.3px] ${
                localMicOn ? "text-green-200" : "text-white/35"
              }`}
            >
              Mic
            </span>
          </button>
        </div>
      </div>

      {/* Right: co-pilot, end, avatar */}
      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={onToggleCopilot}
          className="flex items-center gap-1.5 rounded-full border border-purple-400/30 bg-purple-500/20 px-3 py-1 text-[11px] font-medium text-purple-200 transition-colors hover:bg-purple-500/30"
        >
          <span className="h-1.5 w-1.5 animate-[blink_2s_infinite] rounded-full bg-purple-300" />
          Co-pilot
          <span
            className="text-[10px] opacity-55 transition-transform"
            style={{ transform: copilotOpen ? "rotate(0deg)" : "rotate(180deg)" }}
          >
            ◀
          </span>
        </button>
        <button
          onClick={onEnd}
          className="flex items-center gap-1.5 rounded-lg border border-red-500/40 bg-red-500/[.18] px-3.5 py-[5px] text-[11px] font-semibold tracking-[.1px] text-red-200 transition-colors hover:bg-red-600/30"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-red-300" />
          End Class
        </button>
        <div className="flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-white/15 text-[11px] font-semibold text-white/80">
          {userInitial ?? "T"}
        </div>
      </div>
    </div>
  );
}
