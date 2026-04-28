"use client";
export const dynamic = "force-dynamic";

import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import api from "@/lib/api/client";

type WalletResp = {
  tokens: {
    balance: number;
    earnedTotal: number;
    spentTotal: number;
    weekEarned: number;
    streakDays: number;
  };
  transactions: {
    id: string;
    amount: number;
    title: string;
    source?: string;
    reason: string;
    createdAt: string;
  }[];
  histogram: { date: string; value: number }[];
};

function emojiFor(reason: string, amount: number) {
  if (amount < 0) return "🎁";
  if (reason === "streak_bonus") return "🔥";
  if (reason === "quiz_top_scorer") return "🏆";
  if (reason === "correct_answer") return "✓";
  if (reason === "teacher_reward") return "⭐";
  if (reason === "participation") return "📝";
  return "🪙";
}

export default function WalletPage() {
  const q = useQuery<WalletResp>({
    queryKey: ["student", "wallet-full"],
    queryFn: () => api.get("/student/wallet") as unknown as Promise<WalletResp>,
    refetchInterval: 30_000,
  });

  const data = q.data;
  const histValues = (data?.histogram ?? []).map((h) => h.value);
  const histMax = Math.max(1, ...histValues);

  return (
    <div className="min-h-full bg-bg p-[22px]">
      <div className="mb-3 flex items-center justify-between">
        <p
          className="text-[12px] font-bold uppercase text-white/50"
          style={{ letterSpacing: "0.6px" }}
        >
          🪙 Brain Token Wallet
        </p>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: "320px 1fr" }}>
        {/* Balance card */}
        <div
          className="rounded-[20px] p-[22px] text-white"
          style={{
            background: "linear-gradient(135deg,#1a0533,#2d1065,#3730a3)",
            border: "1px solid rgba(99,102,241,.3)",
            boxShadow: "0 8px 32px rgba(99,102,241,.2)",
          }}
        >
          <p
            className="text-[10px] font-bold uppercase text-white/50"
            style={{ letterSpacing: "0.6px" }}
          >
            Total Balance
          </p>
          <p
            className="mt-2 font-mono text-[48px] font-black leading-none text-white"
            style={{ letterSpacing: "-2px" }}
          >
            {data?.tokens.balance ?? 0}
            <span className="ml-1 text-[20px] font-semibold text-white/50">BT</span>
          </p>
          <p className="mb-4 mt-1.5 text-[11px] text-white/40">
            ≈ {(data?.tokens.earnedTotal ?? 0) * 2} pts lifetime · ⭐⭐⭐
          </p>

          {/* 13-bar chart */}
          <div
            className="mb-4 flex items-end gap-[3px]"
            style={{ height: 50 }}
          >
            {(data?.histogram ?? []).map((h, i) => {
              const isLast = i === (data?.histogram.length ?? 1) - 1;
              const h01 = histMax > 0 ? h.value / histMax : 0;
              return (
                <div
                  key={h.date}
                  className="flex-1 rounded-t-[3px]"
                  style={{
                    minHeight: 4,
                    height: `${Math.max(8, h01 * 100)}%`,
                    background: isLast
                      ? "rgba(99,102,241,.7)"
                      : "rgba(255,255,255,.15)",
                  }}
                  title={`${h.date}: +${h.value} BT`}
                />
              );
            })}
          </div>

          {/* 3-col footer */}
          <div
            className="grid gap-2.5 pt-3.5"
            style={{
              gridTemplateColumns: "1fr 1fr 1fr",
              borderTop: "1px solid rgba(255,255,255,.1)",
            }}
          >
            <div>
              <p className="text-[9.5px] text-white/40">Earned this week</p>
              <p className="mt-0.5 text-[14px] font-bold text-white">
                +{data?.tokens.weekEarned ?? 0} BT
              </p>
            </div>
            <div>
              <p className="text-[9.5px] text-white/40">Streak bonus</p>
              <p className="mt-0.5 text-[14px] font-bold text-white">
                +{(data?.tokens.streakDays ?? 0) * 2} BT
              </p>
            </div>
            <div>
              <p className="text-[9.5px] text-white/40">Lifetime</p>
              <p className="mt-0.5 text-[14px] font-bold text-white">
                {data?.tokens.earnedTotal ?? 0} BT
              </p>
            </div>
          </div>
        </div>

        {/* Transactions panel */}
        <div
          className="rounded-[16px] p-4"
          style={{
            background: "rgba(255,255,255,.03)",
            border: "1px solid rgba(255,255,255,.06)",
          }}
        >
          <div className="flex items-center justify-between">
            <p
              className="text-[12px] font-bold uppercase text-white/50"
              style={{ letterSpacing: "0.6px" }}
            >
              Transaction History
            </p>
            <span className="text-[10px] text-white/35">
              {data?.transactions.length ?? 0} recent
            </span>
          </div>
          {data && data.transactions.length > 0 ? (
            <div className="mt-3 flex flex-col gap-2">
              {data.transactions.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center gap-2.5 rounded-[10px] px-2.5 py-2.5"
                  style={{
                    background: "rgba(255,255,255,.03)",
                    border: "1px solid rgba(255,255,255,.05)",
                  }}
                >
                  <span className="w-8 flex-shrink-0 text-center text-[16px]">
                    {emojiFor(t.reason, t.amount)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11.5px] font-semibold text-white/80">
                      {t.title}
                    </p>
                    <p className="mt-px truncate text-[10px] text-white/35">
                      {t.source ?? "System"} · {format(new Date(t.createdAt), "MMM d, h:mm a")}
                    </p>
                  </div>
                  <span
                    className="text-[12px] font-bold"
                    style={{ color: t.amount >= 0 ? "#4ADE80" : "#F87171" }}
                  >
                    {t.amount >= 0 ? "+" : ""}
                    {t.amount} BT
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-10 text-center text-[11px] text-white/40">
              No transactions yet. Earn your first token by completing a quiz or joining a live class.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
