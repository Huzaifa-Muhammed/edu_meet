"use client";
export const dynamic = "force-dynamic";

import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api/client";

type Summary = {
  overallPct: number;
  totalPoints: number;
  earnedPoints: number;
  rank: number | null;
  classmatesCount: number;
  topics: { id: string; name: string; pct: number; color: "green" | "blue" | "amber" | "red" }[];
  quizHistory: {
    id: string;
    title: string;
    status: "correct" | "wrong" | "partial" | "pending";
    scorePct: number;
    submittedAt?: string;
  }[];
};

const TOPIC_EMOJIS = ["🔢", "📐", "🎯", "🧮", "📊", "📘", "📙", "📕", "📗"];

function barColor(c: Summary["topics"][number]["color"]) {
  if (c === "green") return "#4ADE80";
  if (c === "blue") return "#6366F1";
  if (c === "amber") return "#F59E0B";
  return "#EF4444";
}

export default function ProgressPage() {
  const q = useQuery<Summary>({
    queryKey: ["student", "progress"],
    queryFn: () => api.get("/student/progress") as unknown as Promise<Summary>,
  });

  const s = q.data;
  const pct = s?.overallPct ?? 0;
  const circ = 2 * Math.PI * 34;
  const dash = `${circ}`;
  const offset = circ * (1 - pct / 100);

  return (
    <div className="min-h-full bg-bg p-[22px]">
      <p
        className="mb-3 text-[12px] font-bold uppercase text-white/50"
        style={{ letterSpacing: "0.6px" }}
      >
        📈 My Progress
      </p>

      <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 1fr" }}>
        {/* Left column */}
        <div className="flex flex-col gap-3.5">
          {/* Overview */}
          <div
            className="flex items-center gap-4 rounded-[16px] p-4"
            style={{
              background: "rgba(255,255,255,.04)",
              border: "1px solid rgba(255,255,255,.07)",
            }}
          >
            <div className="relative h-20 w-20 flex-shrink-0">
              <svg viewBox="0 0 80 80" className="h-full w-full">
                <circle
                  cx="40"
                  cy="40"
                  r="34"
                  fill="none"
                  stroke="rgba(255,255,255,.08)"
                  strokeWidth="8"
                />
                <circle
                  cx="40"
                  cy="40"
                  r="34"
                  fill="none"
                  stroke="#6366F1"
                  strokeWidth="8"
                  strokeDasharray={dash}
                  strokeDashoffset={offset}
                  strokeLinecap="round"
                  transform="rotate(-90 40 40)"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center text-[16px] font-extrabold text-white">
                {pct}%
              </div>
            </div>
            <div>
              <p className="text-[14px] font-bold text-white">Overall Score</p>
              <p className="mt-0.5 text-[11px] text-white/40">
                {s?.earnedPoints ?? 0} of {s?.totalPoints ?? 0} points earned
              </p>
              {s?.rank ? (
                <p className="mt-1.5 text-[11px] font-semibold text-[#A5B4FC]">
                  🏆 Rank #{s.rank} of {s.classmatesCount}
                </p>
              ) : (
                <p className="mt-1.5 text-[11px] text-white/40">
                  Complete a graded task to earn your rank
                </p>
              )}
            </div>
          </div>

          {/* Topic bars */}
          <div
            className="flex flex-col gap-2.5 rounded-[16px] p-3.5"
            style={{
              background: "rgba(255,255,255,.03)",
              border: "1px solid rgba(255,255,255,.06)",
            }}
          >
            <p
              className="mb-1 text-[11px] font-bold uppercase text-white/50"
              style={{ letterSpacing: "0.5px" }}
            >
              Topics
            </p>
            {s && s.topics.length > 0 ? (
              s.topics.map((t, i) => (
                <div key={t.id} className="flex items-center gap-2.5">
                  <span className="w-[22px] flex-shrink-0 text-center text-[14px]">
                    {TOPIC_EMOJIS[i % TOPIC_EMOJIS.length]}
                  </span>
                  <span className="flex-1 text-[11px] font-medium text-white/70">
                    {t.name}
                  </span>
                  <div
                    className="flex-[2] overflow-hidden rounded-[3px]"
                    style={{ height: 5, background: "rgba(255,255,255,.08)" }}
                  >
                    <div
                      className="h-full rounded-[3px] transition-all"
                      style={{ width: `${t.pct}%`, background: barColor(t.color) }}
                    />
                  </div>
                  <span className="w-[30px] text-right text-[10px] font-bold text-white/50">
                    {t.pct}%
                  </span>
                </div>
              ))
            ) : (
              <p className="py-4 text-center text-[11px] text-white/40">
                No topic data yet — finish a graded assessment to see progress.
              </p>
            )}
          </div>
        </div>

        {/* Right column: quiz history */}
        <div
          className="rounded-[16px] p-3.5"
          style={{
            background: "rgba(255,255,255,.03)",
            border: "1px solid rgba(255,255,255,.06)",
          }}
        >
          <div className="mb-3 flex items-center justify-between">
            <p
              className="text-[11px] font-bold uppercase text-white/50"
              style={{ letterSpacing: "0.5px" }}
            >
              📋 Quiz History
            </p>
            <span className="text-[10px] text-white/35">
              {s?.quizHistory.length ?? 0} recent
            </span>
          </div>
          {s && s.quizHistory.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {s.quizHistory.slice(0, 10).map((row, i) => (
                <li key={row.id} className="flex items-center gap-2">
                  <span className="w-5 text-[10px] font-bold text-white/40">Q{i + 1}</span>
                  <div
                    className="flex-1 overflow-hidden rounded-[3px]"
                    style={{ height: 6, background: "rgba(255,255,255,.08)" }}
                  >
                    <div
                      className="h-full rounded-[3px]"
                      style={{
                        width: `${row.scorePct}%`,
                        background:
                          row.status === "correct"
                            ? "#4ADE80"
                            : row.status === "wrong"
                              ? "#EF4444"
                              : row.status === "partial"
                                ? "#6366F1"
                                : "#F59E0B",
                      }}
                    />
                  </div>
                  <span
                    className="w-[72px] text-right text-[10px] font-semibold"
                    style={{
                      color:
                        row.status === "correct"
                          ? "#4ADE80"
                          : row.status === "wrong"
                            ? "#F87171"
                            : row.status === "partial"
                              ? "#A5B4FC"
                              : "rgba(255,255,255,.3)",
                    }}
                  >
                    {row.status === "correct"
                      ? `✓ ${row.scorePct}%`
                      : row.status === "wrong"
                        ? `✗ ${row.scorePct}%`
                        : row.status === "partial"
                          ? `${row.scorePct}%`
                          : "Pending"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-6 text-center text-[11px] text-white/40">
              No quiz history yet. Complete an assessment to see it here.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
