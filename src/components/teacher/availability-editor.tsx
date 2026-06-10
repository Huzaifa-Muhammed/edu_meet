"use client";

import { useEffect, useRef, useState } from "react";
import type { AvailabilityBlock } from "@/shared/types/domain";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
// Start-hours for each 1-hour slot: 08:00 … 21:00 (last slot 21:00–22:00).
const HOURS = Array.from({ length: 14 }, (_, i) => i + 8);

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function hourLabel(h: number) {
  const am = h < 12;
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display} ${am ? "AM" : "PM"}`;
}

function blocksToSet(blocks: AvailabilityBlock[]): Set<string> {
  const set = new Set<string>();
  for (const b of blocks) {
    const sh = parseInt(b.start.slice(0, 2), 10);
    const eh = parseInt(b.end.slice(0, 2), 10);
    for (let h = sh; h < eh; h++) {
      if (h >= 8 && h <= 21) set.add(`${b.day}-${h}`);
    }
  }
  return set;
}

function setToBlocks(set: Set<string>): AvailabilityBlock[] {
  const out: AvailabilityBlock[] = [];
  for (let day = 0; day < 7; day++) {
    const hrs = HOURS.filter((h) => set.has(`${day}-${h}`)).sort((a, b) => a - b);
    let i = 0;
    while (i < hrs.length) {
      let j = i;
      while (j + 1 < hrs.length && hrs[j + 1] === hrs[j] + 1) j++;
      out.push({ day, start: `${pad(hrs[i])}:00`, end: `${pad(hrs[j] + 1)}:00` });
      i = j + 1;
    }
  }
  return out;
}

export function AvailabilityEditor({
  initialBlocks,
  saving,
  onSave,
}: {
  initialBlocks: AvailabilityBlock[];
  saving: boolean;
  onSave: (blocks: AvailabilityBlock[]) => void;
}) {
  const [blocked, setBlocked] = useState<Set<string>>(() =>
    blocksToSet(initialBlocks),
  );
  const [dirty, setDirty] = useState(false);
  // Drag-paint state
  const painting = useRef(false);
  const paintState = useRef(false); // true = blocking, false = unblocking

  useEffect(() => {
    setBlocked(blocksToSet(initialBlocks));
    setDirty(false);
  }, [initialBlocks]);

  useEffect(() => {
    const stop = () => (painting.current = false);
    window.addEventListener("mouseup", stop);
    return () => window.removeEventListener("mouseup", stop);
  }, []);

  function apply(key: string, block: boolean) {
    setBlocked((prev) => {
      const next = new Set(prev);
      if (block) next.add(key);
      else next.delete(key);
      return next;
    });
    setDirty(true);
  }

  function onCellDown(key: string) {
    const willBlock = !blocked.has(key);
    painting.current = true;
    paintState.current = willBlock;
    apply(key, willBlock);
  }
  function onCellEnter(key: string) {
    if (painting.current) apply(key, paintState.current);
  }

  function clearAll() {
    setBlocked(new Set());
    setDirty(true);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-t3">
          Click or drag to mark hours you’re{" "}
          <span className="font-semibold text-t">unavailable</span>. The AI
          never schedules classes inside blocked hours.
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={clearAll}
            className="rounded-lg border border-bd bg-surf px-2.5 py-1.5 text-[11px] font-semibold text-t2 hover:bg-panel"
          >
            Clear blocks
          </button>
          <button
            onClick={() => {
              onSave(setToBlocks(blocked));
              setDirty(false);
            }}
            disabled={saving || !dirty}
            className="rounded-lg bg-acc px-3 py-1.5 text-[11px] font-semibold text-white hover:opacity-90 disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save availability"}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[560px]">
          {/* header */}
          <div
            className="grid"
            style={{ gridTemplateColumns: "56px repeat(7,1fr)", gap: "4px" }}
          >
            <div />
            {DAYS.map((d) => (
              <div
                key={d}
                className="text-center text-[10px] font-semibold uppercase tracking-wide text-t3"
              >
                {d}
              </div>
            ))}
          </div>
          {/* rows */}
          {HOURS.map((h) => (
            <div
              key={h}
              className="mt-1 grid"
              style={{ gridTemplateColumns: "56px repeat(7,1fr)", gap: "4px" }}
            >
              <div className="flex items-center justify-end pr-1 text-[9.5px] font-medium text-t3">
                {hourLabel(h)}
              </div>
              {DAYS.map((_, day) => {
                const key = `${day}-${h}`;
                const isBlocked = blocked.has(key);
                return (
                  <button
                    key={key}
                    onMouseDown={() => onCellDown(key)}
                    onMouseEnter={() => onCellEnter(key)}
                    className="h-7 rounded-md border transition-colors"
                    style={{
                      background: isBlocked
                        ? "rgba(239,68,68,.22)"
                        : "rgba(74,222,128,.10)",
                      borderColor: isBlocked
                        ? "rgba(239,68,68,.5)"
                        : "var(--bd)",
                    }}
                    title={`${DAYS[day]} ${hourLabel(h)} — ${
                      isBlocked ? "Unavailable" : "Available"
                    }`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-4 text-[10px] text-t3">
        <span className="flex items-center gap-1.5">
          <span
            className="h-3 w-3 rounded"
            style={{ background: "rgba(74,222,128,.10)", border: "1px solid var(--bd)" }}
          />
          Available
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="h-3 w-3 rounded"
            style={{ background: "rgba(239,68,68,.22)", border: "1px solid rgba(239,68,68,.5)" }}
          />
          Blocked
        </span>
      </div>
    </div>
  );
}
