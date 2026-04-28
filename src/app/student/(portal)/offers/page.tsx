"use client";
export const dynamic = "force-dynamic";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "@/lib/api/client";

type Offer = {
  id: string;
  title: string;
  description: string;
  emoji: string;
  costBT: number;
  badge?: "hot" | "new" | null;
};
type Redemption = { id: string; offerId: string };
type OffersResp = { offers: Offer[]; redemptions: Redemption[]; balance: number };

export default function OffersPage() {
  const qc = useQueryClient();
  const q = useQuery<OffersResp>({
    queryKey: ["student", "offers"],
    queryFn: () => api.get("/student/offers") as unknown as Promise<OffersResp>,
  });

  const redeem = useMutation({
    mutationFn: (offerId: string) => api.post(`/student/offers/${offerId}/redeem`),
    onSuccess: () => {
      toast.success("Redeemed!");
      qc.invalidateQueries({ queryKey: ["student", "offers"] });
      qc.invalidateQueries({ queryKey: ["student", "wallet"] });
      qc.invalidateQueries({ queryKey: ["student", "wallet-full"] });
      qc.invalidateQueries({ queryKey: ["student", "wallet-balance"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const redeemedSet = new Set(q.data?.redemptions.map((r) => r.offerId) ?? []);
  const balance = q.data?.balance ?? 0;
  const offers = q.data?.offers ?? [];

  return (
    <div className="min-h-full bg-bg p-[22px]">
      <p
        className="mb-3 text-[12px] font-bold uppercase text-white/50"
        style={{ letterSpacing: "0.6px" }}
      >
        🎁 Offers & Rewards
      </p>

      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
        {offers.map((o) => {
          const redeemed = redeemedSet.has(o.id);
          const affordable = balance >= o.costBT;
          const isHot = o.badge === "hot";
          const isNew = o.badge === "new";
          return (
            <div
              key={o.id}
              className="relative flex flex-col gap-1.5 rounded-[16px] p-4 transition-all"
              style={{
                background: isHot
                  ? "rgba(251,146,60,.04)"
                  : isNew
                    ? "rgba(99,102,241,.04)"
                    : "rgba(255,255,255,.04)",
                border: isHot
                  ? "1px solid rgba(251,146,60,.25)"
                  : isNew
                    ? "1px solid rgba(99,102,241,.25)"
                    : "1px solid rgba(255,255,255,.08)",
                opacity: redeemed ? 0.5 : 1,
              }}
            >
              {o.badge && (
                <span
                  className="absolute right-2.5 top-2.5 rounded-full px-[7px] py-0.5 text-[9px] font-bold"
                  style={{
                    background: isHot
                      ? "rgba(251,146,60,.2)"
                      : "rgba(99,102,241,.2)",
                    color: isHot ? "#FB923C" : "#A5B4FC",
                  }}
                >
                  {isHot ? "🔥 Hot" : "✨ New"}
                </span>
              )}

              <div className="mb-1 text-[24px]">{o.emoji}</div>
              <p className="text-[13px] font-bold text-white">{o.title}</p>
              <p
                className="flex-1 text-[10.5px] text-white/45"
                style={{ lineHeight: 1.5 }}
              >
                {o.description}
              </p>

              <p className="mt-1 text-[14px] font-extrabold text-[#A5B4FC]">
                {o.costBT} BT
              </p>

              <button
                onClick={() => redeem.mutate(o.id)}
                disabled={redeemed || !affordable || redeem.isPending}
                className="mt-1.5 w-full rounded-full py-[7px] text-[11px] font-bold transition-all"
                style={{
                  background: redeemed
                    ? "rgba(255,255,255,.05)"
                    : "rgba(99,102,241,.15)",
                  border: redeemed
                    ? "1px solid rgba(255,255,255,.1)"
                    : "1px solid rgba(99,102,241,.4)",
                  color: redeemed ? "rgba(255,255,255,.4)" : "#A5B4FC",
                  cursor: redeemed || !affordable ? "not-allowed" : "pointer",
                }}
              >
                {redeemed
                  ? "Redeemed!"
                  : redeem.isPending
                    ? "Redeeming…"
                    : affordable
                      ? "Redeem"
                      : `Need ${o.costBT - balance} more BT`}
              </button>
            </div>
          );
        })}
      </div>

      <p className="mt-3.5 text-right text-[12px] text-white/50">
        Your balance: <b className="text-[#A5B4FC]">{balance} BT</b>
      </p>
    </div>
  );
}
