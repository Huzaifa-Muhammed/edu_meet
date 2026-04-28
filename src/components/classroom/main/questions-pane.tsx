"use client";

import { useState } from "react";
import { cn } from "@/lib/utils/cn";
import { Plus } from "lucide-react";

interface QuestionsPaneProps {
  meetingId: string;
}

const mockQuestions = [
  {
    id: "q1",
    num: 1,
    text: "What is the first step when solving 2x + 5 = 13?",
    difficulty: "Easy",
    status: "done" as const,
  },
  {
    id: "q2",
    num: 2,
    text: "Solve for x: 3(x - 2) = 9",
    difficulty: "Medium",
    status: "live" as const,
  },
  {
    id: "q3",
    num: 3,
    text: "How many solutions does x + 1 = x + 2 have?",
    difficulty: "Hard",
    status: "pending" as const,
  },
];

export function QuestionsPane({ meetingId }: QuestionsPaneProps) {
  const [selectedQ, setSelectedQ] = useState<string | null>("q2");

  const diffColors: Record<string, string> = {
    Easy: "bg-gbg text-gt",
    Medium: "bg-abg text-at",
    Hard: "bg-rbg text-rt",
  };

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Question bank sidebar */}
      <div className="flex w-[230px] flex-shrink-0 flex-col overflow-hidden border-r border-sidebd bg-side">
        <div className="flex items-center justify-between border-b border-sidebd px-3 py-2.5">
          <span className="text-[11px] font-semibold text-t2">
            Question Bank
          </span>
          <button className="flex h-5 w-5 items-center justify-center rounded bg-acc text-white">
            <Plus className="h-3 w-3" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {mockQuestions.map((q) => (
            <button
              key={q.id}
              onClick={() => setSelectedQ(q.id)}
              className={cn(
                "mb-1 w-full rounded-[9px] border bg-surf text-left transition-all",
                q.status === "live"
                  ? "border-l-[3px] border-pbd bg-pbg border-l-purple"
                  : q.status === "done"
                    ? "border-bd opacity-45"
                    : "border-bd",
                selectedQ === q.id && "!border-acc !bg-acc",
              )}
            >
              <div className="flex gap-2 px-2.5 py-2">
                <div
                  className={cn(
                    "flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-full border text-[9px] font-semibold",
                    selectedQ === q.id
                      ? "border-white/20 bg-white/15 text-white"
                      : q.status === "live"
                        ? "border-pbd bg-white text-purple"
                        : "border-bd2 bg-panel2",
                  )}
                >
                  {q.num}
                </div>
                <span
                  className={cn(
                    "text-[11px] font-medium leading-snug",
                    selectedQ === q.id
                      ? "font-semibold text-white/90"
                      : "text-t",
                  )}
                >
                  {q.text}
                </span>
              </div>
              <div className="flex gap-1 px-2.5 pb-2">
                <span
                  className={`rounded px-1.5 py-0.5 text-[8px] font-bold uppercase ${diffColors[q.difficulty] ?? ""}`}
                >
                  {q.difficulty}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Question centre */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* KPIs */}
        <div className="flex border-b-2 border-bd bg-panel">
          <div className="border-r border-bd px-3.5 py-2">
            <div className="text-[17px] font-semibold tracking-tight">3</div>
            <div className="text-[9px] font-medium uppercase tracking-wider text-t3">
              Total
            </div>
          </div>
          <div className="border-r border-bd px-3.5 py-2">
            <div className="text-[17px] font-semibold tracking-tight text-green">
              1
            </div>
            <div className="text-[9px] font-medium uppercase tracking-wider text-t3">
              Asked
            </div>
          </div>
          <div className="px-3.5 py-2">
            <div className="text-[17px] font-semibold tracking-tight text-purple">
              1
            </div>
            <div className="text-[9px] font-medium uppercase tracking-wider text-t3">
              Live
            </div>
          </div>
        </div>

        {/* Selected question details */}
        <div className="flex-1 overflow-y-auto p-4">
          {selectedQ === "q2" && (
            <div>
              <div className="mb-3 flex items-start gap-2.5">
                <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-acc text-[11px] font-bold text-white shadow-md">
                  2
                </div>
                <div className="text-[13px] font-semibold leading-snug">
                  Solve for x: 3(x - 2) = 9
                </div>
              </div>

              {/* Options */}
              <div className="mb-3 grid grid-cols-2 gap-1.5">
                {["x = 3", "x = 5", "x = 1", "x = -1"].map((opt, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex items-center gap-2 rounded-[9px] border-[1.5px] bg-panel px-3 py-2",
                      i === 1
                        ? "border-green bg-gbg shadow-[0_0_0_1px_rgba(22,163,74,.12)]"
                        : "border-bd",
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-[1.5px] text-[10px] font-bold",
                        i === 1
                          ? "border-green bg-green text-white"
                          : "border-bd2 bg-white",
                      )}
                    >
                      {String.fromCharCode(65 + i)}
                    </div>
                    <span className="text-[11px] font-medium">{opt}</span>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <button className="rounded-lg bg-purple px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-pt">
                  Close Question
                </button>
                <span className="text-[10px] text-t3">
                  8 of 13 responded
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
