"use client";

import { useState } from "react";
import { cn } from "@/lib/utils/cn";
import { Sparkles, TrendingUp, MessageCircle, X } from "lucide-react";

interface InsightsTabProps {
  meetingId: string;
}

type CopilotTab = "insights" | "trends" | "ask";

const mockInsights = [
  {
    id: "i1",
    icon: "⚡",
    title: "Low engagement detected",
    text: "3 students haven't responded in the last 5 minutes. Consider a quick check-in or poll.",
    time: "2 min ago",
    actions: [
      { label: "Send check-in", actionKey: "checkin" },
      { label: "Dismiss", actionKey: "dismiss" },
    ],
  },
  {
    id: "i2",
    icon: "🎯",
    title: "Question pattern",
    text: "Multiple students are asking about the balancing analogy. Consider revisiting slide 2.",
    time: "5 min ago",
    actions: [
      { label: "Go to slide", actionKey: "slide" },
      { label: "Dismiss", actionKey: "dismiss" },
    ],
  },
];

export function InsightsTab({ meetingId }: InsightsTabProps) {
  const [tab, setTab] = useState<CopilotTab>("insights");
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const tabs: { key: CopilotTab; label: string; icon: React.ReactNode }[] = [
    { key: "insights", label: "Insights", icon: <Sparkles className="h-3 w-3" /> },
    { key: "trends", label: "Trends", icon: <TrendingUp className="h-3 w-3" /> },
    { key: "ask", label: "Ask AI", icon: <MessageCircle className="h-3 w-3" /> },
  ];

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-cpbd px-3 py-2.5">
        <Sparkles className="h-3.5 w-3.5 text-purple" />
        <span className="text-[11px] font-semibold text-pt">AI Co-pilot</span>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-cpbd">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1 border-b-2 py-2 text-[10px] font-semibold transition-all",
              tab === t.key
                ? "border-purple text-pt"
                : "border-transparent text-t3 hover:text-t2",
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {tab === "insights" && (
          <div className="space-y-2">
            {mockInsights
              .filter((i) => !dismissed.has(i.id))
              .map((insight) => (
                <div
                  key={insight.id}
                  className="rounded-[9px] border border-pbd bg-pbg p-2.5"
                >
                  <div className="mb-1.5 flex items-start gap-1.5">
                    <span className="text-sm">{insight.icon}</span>
                    <div className="flex-1">
                      <div className="text-[10px] font-semibold text-pt">
                        {insight.title}
                      </div>
                      <div className="text-[9px] text-t3">{insight.time}</div>
                    </div>
                    <button
                      onClick={() =>
                        setDismissed((prev) => new Set(prev).add(insight.id))
                      }
                      className="text-t3 hover:text-t2"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                  <p className="mb-2 text-[11px] leading-relaxed text-t">
                    {insight.text}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {insight.actions
                      .filter((a) => a.actionKey !== "dismiss")
                      .map((action) => (
                        <button
                          key={action.actionKey}
                          className="rounded-[5px] border border-pbd bg-surf px-2 py-0.5 text-[9px] font-semibold text-pt transition-colors hover:bg-pbg"
                        >
                          {action.label}
                        </button>
                      ))}
                  </div>
                </div>
              ))}
          </div>
        )}

        {tab === "trends" && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <TrendingUp className="mb-2 h-6 w-6 text-t3" />
            <p className="text-xs text-t3">
              Trends will appear as more data is collected
            </p>
          </div>
        )}

        {tab === "ask" && (
          <div className="flex flex-col gap-3">
            <p className="text-[11px] text-t3">
              Ask the AI co-pilot anything about this class session.
            </p>
            <textarea
              placeholder="e.g. Suggest a practice problem for struggling students..."
              rows={3}
              className="w-full rounded-lg border border-cpbd bg-surf px-3 py-2 text-[11px] text-t outline-none placeholder:text-t3"
            />
            <button className="self-end rounded-lg bg-purple px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-pt">
              Ask Co-pilot
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
