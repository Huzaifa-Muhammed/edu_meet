"use client";

import { Video, Mic, MonitorUp, Maximize2 } from "lucide-react";

interface VideoPaneProps {
  meetingId: string;
}

export function VideoPane({ meetingId }: VideoPaneProps) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden p-2.5">
      {/* Video stage */}
      <div className="relative flex-shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-[#1E1B4B] to-[#1E293B]" style={{ height: 220 }}>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-white/15 bg-white/10 text-[13px] font-medium text-white/60">
            Ms. K
          </div>
          <span className="text-[11px] text-white/35">
            Live session in progress
          </span>
        </div>

        {/* Student avatars strip */}
        <div className="absolute right-2.5 top-2.5 flex gap-1">
          {["A", "B", "C", "D", "E"].map((initial) => (
            <div
              key={initial}
              className="flex h-[27px] w-[27px] items-center justify-center rounded-full border-2 border-white/12 bg-white/10 text-[8px] font-semibold text-white/45"
            >
              {initial}
            </div>
          ))}
        </div>

        {/* Live badge */}
        <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5 rounded-full bg-black/45 px-2 py-0.5">
          <div className="h-[5px] w-[5px] rounded-full bg-green" />
          <span className="text-[10px] font-medium text-white/75">Live</span>
        </div>

        {/* Controls */}
        <div className="absolute bottom-2.5 right-2.5 flex gap-1">
          {[MonitorUp, Maximize2].map((Icon, i) => (
            <button
              key={i}
              className="flex h-[27px] w-[27px] items-center justify-center rounded-full border border-white/10 bg-black/40 transition-colors hover:bg-white/12"
            >
              <Icon className="h-3 w-3 text-white/60" />
            </button>
          ))}
        </div>
      </div>

      {/* Drag handle */}
      <div className="flex h-[7px] cursor-row-resize items-center justify-center">
        <div className="h-[2px] w-[34px] rounded-full bg-bd" />
      </div>

      {/* Lower panel — chat placeholder */}
      <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-bd bg-surf">
        <div className="flex border-b border-bd">
          <div className="flex-1 border-b-2 border-acc py-2 text-center text-[11px] font-medium text-acc">
            Chat
          </div>
          <div className="flex-1 py-2 text-center text-[11px] font-medium text-t3">
            Scribe
          </div>
        </div>
        <div className="flex flex-1 flex-col overflow-y-auto p-3">
          <div className="flex gap-2">
            <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-bbg text-[9px] font-semibold text-bt">
              AK
            </div>
            <div>
              <div className="text-[10px] font-medium text-t3">Amir K.</div>
              <div className="text-xs text-t2">
                Could you explain the balancing analogy again?
              </div>
            </div>
          </div>
        </div>
        <div className="flex gap-1.5 border-t border-bd px-3 py-2">
          <input
            placeholder="Type a message..."
            className="flex-1 rounded-full border border-bd px-3 py-1.5 text-xs text-t outline-none placeholder:text-t3"
          />
          <button className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-acc text-sm text-white">
            ↑
          </button>
        </div>
      </div>
    </div>
  );
}
