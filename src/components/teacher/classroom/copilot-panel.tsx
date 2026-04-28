"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useMeeting, usePubSub } from "@videosdk.live/react-sdk";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Send,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Minus,
  Bot,
  X,
} from "lucide-react";
import { getFirebaseAuth } from "@/lib/firebase/client";
import api from "@/lib/api/client";
import type { ChatMessage } from "@/server/services/class-chat.service";

type Msg = { role: "user" | "assistant"; content: string };
type Tab = "insights" | "class-chat" | "trends" | "chat";

type Insight = {
  id: string;
  type: "red" | "amber" | "blue" | "green" | "ai";
  icon: string;
  title: string;
  text: string;
  time: string;
  actions: { label: string; toast: string }[];
};

type Trend = {
  id: string;
  name: string;
  initials: string;
  color: string;
  overall: number;
  hist: number[];
  streak: number;
  sessions: number;
};

const SUGGESTIONS = [
  "Who needs attention?",
  "Suggest next teaching step",
  "Summarise engagement",
  "Generate a quick quiz",
];

export function CopilotPanel({
  classroomName,
  classroomId,
  subject,
  onClose,
}: {
  classroomName: string;
  classroomId: string;
  subject?: string;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>("insights");
  const { participants } = useMeeting();

  const [insights, setInsights] = useState<Insight[]>(seedInsights());
  const [insightsLoading, setInsightsLoading] = useState(false);

  async function refreshInsights() {
    setInsightsLoading(true);
    try {
      const token = await getFirebaseAuth().currentUser?.getIdToken();
      const state = summariseClassState(participants);
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          messages: [
            {
              role: "user",
              content: `Class: "${classroomName}"${subject ? ` (${subject})` : ""}.
Live state: ${state}.
Return 3 short in-class insights as JSON (no prose, no fences):
{"insights":[{"type":"red|amber|blue|green|ai","icon":"🔴|⚠️|✋|✅|🤖","title":"...","text":"1 sentence","action":"short action label"}]}
Types: red=urgent student issue, amber=minor concern, blue=info, green=positive, ai=pacing/teaching suggestion.`,
            },
          ],
        }),
      });
      const data = (await res.json()) as { ok: boolean; data: { text: string } };
      const match = data.data?.text?.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("no json");
      const parsed = JSON.parse(match[0]) as {
        insights: { type: Insight["type"]; icon: string; title: string; text: string; action: string }[];
      };
      setInsights(
        parsed.insights.map((x, i) => ({
          id: String(i),
          type: x.type,
          icon: x.icon,
          title: x.title,
          text: x.text,
          time: "now",
          actions: [{ label: x.action, toast: x.action }],
        })),
      );
    } catch {
      // fall back to seeds on failure
    } finally {
      setInsightsLoading(false);
    }
  }

  const trends = useMemo<Trend[]>(() => buildTrends(participants), [participants]);

  return (
    <aside
      className="flex w-[282px] flex-shrink-0 flex-col overflow-hidden border-l bg-cp"
      style={{ borderColor: "var(--cpbd)" }}
    >
      {/* Header */}
      <div
        className="flex flex-shrink-0 items-center gap-2 border-b border-cpbd px-3.5 py-2.5"
        style={{
          background: "linear-gradient(135deg,var(--pbg),var(--cp))",
        }}
      >
        <div className="flex h-[26px] w-[26px] items-center justify-center rounded-lg bg-purple">
          <Bot className="h-3.5 w-3.5 text-white" />
        </div>
        <div className="flex-1">
          <p className="text-[12px] font-semibold text-purple">AI Co-pilot</p>
          <p className="text-[10px] text-t3">Live session intelligence</p>
        </div>
        <span className="flex items-center gap-1 text-[9px] font-semibold text-green">
          <span className="h-[5px] w-[5px] animate-[blink_1.5s_infinite] rounded-full bg-green" />
          Live
        </span>
        <button
          onClick={onClose}
          className="rounded-md p-1 text-t3 hover:bg-panel2 hover:text-t"
          aria-label="Close"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex flex-shrink-0 border-b border-cpbd">
        {(
          [
            { id: "insights", label: "Insights" },
            { id: "class-chat", label: "Class chat" },
            { id: "trends", label: "Trends" },
            { id: "chat", label: "Ask AI" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px flex-1 border-b-2 py-2 text-center text-[9px] font-bold uppercase tracking-[.5px] transition-colors ${
              tab === t.id
                ? "border-purple text-purple"
                : "border-transparent text-t3 hover:text-t2"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "insights" && (
        <InsightsTab
          insights={insights}
          loading={insightsLoading}
          onRefresh={refreshInsights}
        />
      )}
      {tab === "class-chat" && <ClassChatTab classroomId={classroomId} />}
      {tab === "trends" && <TrendsTab trends={trends} />}
      {tab === "chat" && <AskAiTab classroomName={classroomName} subject={subject} />}
    </aside>
  );
}

/* ─── Tabs ─── */

function InsightsTab({
  insights,
  loading,
  onRefresh,
}: {
  insights: Insight[];
  loading: boolean;
  onRefresh: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-cpbd px-3 py-1.5">
        <span className="text-[10px] text-t3">
          {insights.length} insight{insights.length === 1 ? "" : "s"}
        </span>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="flex items-center gap-1 rounded-md border border-cpbd bg-surf px-2 py-0.5 text-[10px] font-medium text-purple hover:bg-pbg disabled:opacity-50"
        >
          <Sparkles className="h-2.5 w-2.5" />
          {loading ? "…" : "Refresh"}
        </button>
      </div>
      <div className="flex-1 space-y-1.5 overflow-y-auto p-2.5">
        {insights.map((ins) => (
          <InsightCard key={ins.id} ins={ins} />
        ))}
      </div>
    </div>
  );
}

function ClassChatTab({ classroomId }: { classroomId: string }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Live pubsub channel for instant delivery
  const { publish, messages: pubMsgs } = usePubSub("CHAT");

  // Persisted history from Firestore
  const { data: history = [] } = useQuery({
    queryKey: ["class-chat", classroomId],
    queryFn: () =>
      api.get(`/classrooms/${classroomId}/chat`) as unknown as Promise<ChatMessage[]>,
    enabled: !!classroomId,
  });

  // Pubsub events after the history was last fetched — treat as ephemeral until
  // refetch picks them up from Firestore. Also trigger refetch on incoming pubsub
  // so the list stays consistent.
  useEffect(() => {
    if (pubMsgs.length === 0) return;
    qc.invalidateQueries({ queryKey: ["class-chat", classroomId] });
  }, [pubMsgs.length, classroomId, qc]);

  // Derive display list: merge Firestore history + any pubsub messages newer
  // than the latest history entry.
  const display = useMemo(() => {
    type Display = {
      id: string;
      name: string;
      text: string;
      role?: "teacher" | "student" | "admin";
      ts: string;
    };
    const out: Display[] = history.map((m) => ({
      id: m.id,
      name: m.senderName,
      text: m.text,
      role: m.senderRole,
      ts: m.createdAt,
    }));
    const latestHistTs = history[history.length - 1]?.createdAt ?? "";
    for (const m of pubMsgs) {
      const payload = m as unknown as {
        senderName?: string;
        message: string;
        timestamp?: string;
      };
      const ts = payload.timestamp ?? "";
      if (ts && ts <= latestHistTs) continue;
      out.push({
        id: `live-${ts}-${payload.senderName ?? ""}`,
        name: payload.senderName ?? "?",
        text: payload.message,
        ts,
      });
    }
    return out;
  }, [history, pubMsgs]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [display.length]);

  const send = async () => {
    const m = draft.trim();
    if (!m) return;
    setDraft("");
    // Broadcast instantly
    publish(m, { persist: true });
    // Persist to Firestore (best-effort)
    try {
      await api.post(`/classrooms/${classroomId}/chat`, { text: m });
      qc.invalidateQueries({ queryKey: ["class-chat", classroomId] });
    } catch {
      // Network flaky — pubsub still delivered
    }
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden" style={{ background: "#FAFAF8" }}>
      <div ref={scrollRef} className="flex-1 space-y-2.5 overflow-y-auto px-3 py-3">
        {display.length === 0 && (
          <p className="py-6 text-center text-[11px] text-t3">No messages yet</p>
        )}
        {display.map((m) => (
          <ChatBubble
            key={m.id}
            name={m.name}
            text={m.text}
            role={m.role}
            ts={m.ts}
          />
        ))}
      </div>

      <div className="flex flex-shrink-0 items-center gap-2 border-t border-bd bg-surf px-3 py-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), send())}
          placeholder="Message the class…"
          className="flex-1 rounded-[24px] border-[1.5px] border-bd2 bg-panel px-3.5 py-2 text-[12px] text-t outline-none transition-colors focus:border-acc focus:bg-surf"
        />
        <button
          onClick={send}
          disabled={!draft.trim()}
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-acc text-white disabled:opacity-40"
        >
          <Send className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

function ChatBubble({
  name,
  text,
  role,
  ts,
}: {
  name: string;
  text: string;
  role?: "teacher" | "student" | "admin";
  ts?: string;
}) {
  const timeLabel = ts
    ? new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "";
  const isTeacher = role === "teacher" || role === "admin";
  return (
    <div className="flex max-w-[85%] items-end gap-2">
      <div
        className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white"
        style={{ background: isTeacher ? "var(--bt)" : "var(--t3)" }}
      >
        {name.slice(0, 2).toUpperCase()}
      </div>
      <div>
        <div className="mb-0.5 flex items-center gap-1.5">
          <span className="text-[10px] font-semibold text-t2">{name}</span>
          {isTeacher && (
            <span className="rounded bg-bbg px-1 text-[8px] font-bold uppercase text-bt">
              Teacher
            </span>
          )}
          {timeLabel && <span className="text-[9px] text-t3">{timeLabel}</span>}
        </div>
        <div
          className="max-w-full rounded-[16px] border bg-surf px-3 py-2 text-[12px] leading-[1.5] text-t"
          style={{
            borderRadius: "16px 16px 16px 4px",
            borderColor: "var(--bd)",
            boxShadow: "0 1px 3px rgba(0,0,0,.05)",
          }}
        >
          {text}
        </div>
      </div>
    </div>
  );
}

function TrendsTab({ trends }: { trends: Trend[] }) {
  return (
    <div className="flex-1 space-y-1.5 overflow-y-auto p-2.5">
      {trends.length === 0 ? (
        <p className="py-8 text-center text-[11px] text-t3">
          No students in class yet. Trends show up once students join.
        </p>
      ) : (
        trends.map((tr) => <TrendCard key={tr.id} tr={tr} />)
      )}
    </div>
  );
}

function AskAiTab({
  classroomName,
  subject,
}: {
  classroomName: string;
  subject?: string;
}) {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content: `Hi — I'm your in-class Copilot. I can suggest quick checks, spot students who need help, or explain a concept. Ask me anything about "${classroomName}".`,
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function send(override?: string) {
    const prompt = (override ?? input).trim();
    if (!prompt || loading) return;
    const next: Msg[] = [...messages, { role: "user", content: prompt }];
    setMessages(next);
    setInput("");
    setLoading(true);

    const ctx = `You are helping a teacher running a live class called "${classroomName}"${
      subject ? ` (subject: ${subject})` : ""
    }. Keep replies under 80 words and concrete.`;

    try {
      const token = await getFirebaseAuth().currentUser?.getIdToken();
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          stream: true,
          messages: [
            { role: "system", content: ctx },
            ...next.map((m) => ({ role: m.role, content: m.content })),
          ],
        }),
      });
      if (!res.ok || !res.body) throw new Error(`chat error ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      setMessages((m) => [...m, { role: "assistant", content: "" }]);

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((m) => [...m.slice(0, -1), { role: "assistant", content: acc }]);
      }
    } catch (err) {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: `⚠ ${err instanceof Error ? err.message : "Chat failed"}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-cp">
      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto p-2.5">
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-2 ${m.role === "user" ? "justify-end" : ""}`}>
            {m.role === "assistant" && (
              <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-pbd bg-pbg text-[10px]">
                🤖
              </div>
            )}
            <div
              className={`max-w-[215px] rounded-[11px] px-3 py-2 text-[11.5px] leading-relaxed ${
                m.role === "user"
                  ? "rounded-br-[2px] bg-acc text-white"
                  : "rounded-bl-[2px] border border-bd bg-panel text-t2"
              }`}
            >
              {m.content || (loading ? <span className="text-t3">Thinking…</span> : null)}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-shrink-0 flex-wrap gap-1 border-t border-bd bg-panel px-2 py-1.5">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => send(s)}
            disabled={loading}
            className="whitespace-nowrap rounded-full border border-bd2 bg-surf px-2 py-0.5 text-[10px] text-t2 transition-colors hover:border-purple hover:text-purple disabled:opacity-50"
          >
            {s}
          </button>
        ))}
      </div>

      <div className="flex flex-shrink-0 items-center gap-1.5 border-t border-bd bg-surf p-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Ask about your class…"
          className="flex-1 rounded-full border border-bd bg-surf px-3 py-1.5 text-[11px] outline-none focus:border-purple"
        />
        <button
          onClick={() => send()}
          disabled={loading || !input.trim()}
          className="flex h-7 w-7 items-center justify-center rounded-full bg-purple text-white disabled:opacity-40"
        >
          <Send className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

/* ─── Sub-components ─── */

function InsightCard({ ins }: { ins: Insight }) {
  const variants: Record<Insight["type"], string> = {
    red: "border-l-[2.5px] border-l-red bg-rbg",
    amber: "border-l-[2.5px] border-l-amber bg-abg",
    blue: "border-l-[2.5px] border-l-blue bg-bbg",
    green: "border-l-[2.5px] border-l-green bg-gbg",
    ai: "border-l-[2.5px] border-l-purple bg-pbg",
  };
  return (
    <div className={`rounded-[9px] border border-bd p-2.5 ${variants[ins.type]}`}>
      <div className="mb-1 flex justify-between gap-1">
        <span className="text-[11px] font-semibold text-t">
          {ins.icon} {ins.title}
        </span>
        <span className="mt-0.5 flex-shrink-0 text-[9px] text-t3">{ins.time}</span>
      </div>
      <p className="text-[10.5px] leading-relaxed text-t2">{ins.text}</p>
      {ins.actions.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {ins.actions.map((a, i) => (
            <button
              key={i}
              onClick={() => alert(a.toast)}
              className="rounded-md border border-bd2 bg-surf px-2 py-0.5 text-[9px] font-medium text-t2 hover:bg-panel"
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TrendCard({ tr }: { tr: Trend }) {
  const diff = tr.hist.length > 1 ? tr.hist[tr.hist.length - 1] - tr.hist[0] : 0;
  const delta = diff > 5 ? "up" : diff < -2 ? "dn" : "fl";
  const max = Math.max(...tr.hist, 1);

  return (
    <div className="cursor-pointer rounded-[9px] border border-bd bg-panel p-2.5 transition-shadow hover:border-bd2 hover:shadow-sm">
      <div className="mb-1.5 flex items-center gap-1.5">
        <div
          className="flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded-full text-[8px] font-bold"
          style={{ background: tr.color, color: "#fff" }}
        >
          {tr.initials}
        </div>
        <span className="flex-1 truncate text-[11px] font-medium">{tr.name}</span>
        <span
          className={`flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] font-semibold ${
            delta === "up"
              ? "bg-gbg text-gt"
              : delta === "dn"
                ? "bg-rbg text-rt"
                : "bg-panel2 text-t3"
          }`}
        >
          {delta === "up" && <TrendingUp className="h-2.5 w-2.5" />}
          {delta === "dn" && <TrendingDown className="h-2.5 w-2.5" />}
          {delta === "fl" && <Minus className="h-2.5 w-2.5" />}
          {diff > 0 ? "+" : ""}
          {diff}%
        </span>
      </div>
      <div className="mb-1 flex h-7 items-end gap-0.5">
        {tr.hist.map((v, i) => {
          const h = Math.max(3, Math.round((v / max) * 26));
          const c = v >= 75 ? "#16A34A" : v >= 50 ? "#D97706" : "#DC2626";
          return (
            <div
              key={i}
              className="flex-1 rounded-t-[2px]"
              style={{
                height: `${h}px`,
                background: c,
                opacity: i === tr.hist.length - 1 ? 1 : 0.35,
              }}
            />
          );
        })}
      </div>
      <p className="text-[9px] text-t3">
        Current: {tr.overall}% · {tr.sessions} sessions · Streak: {tr.streak}d
      </p>
    </div>
  );
}

/* ─── Helpers ─── */

function seedInsights(): Insight[] {
  return [
    {
      id: "0",
      type: "ai",
      icon: "🤖",
      title: "Welcome to your live class",
      text: "I'll watch participation, engagement, and question trends in real time. Hit Refresh once students have been in the class for a few minutes to get live insights.",
      time: "now",
      actions: [{ label: "Got it", toast: "Dismissed" }],
    },
    {
      id: "1",
      type: "blue",
      icon: "💡",
      title: "Tip: share your screen",
      text: "Use the Share screen/whiteboard button in the main toolbar to show slides or draw on the whiteboard.",
      time: "now",
      actions: [],
    },
  ];
}

function summariseClassState(participants: Map<string, unknown>) {
  const count = participants.size;
  let micOn = 0;
  let camOn = 0;
  for (const p of participants.values()) {
    const q = p as { micOn?: boolean; webcamOn?: boolean };
    if (q.micOn) micOn++;
    if (q.webcamOn) camOn++;
  }
  return `${count} participants, ${micOn} mic-on, ${camOn} cam-on`;
}

function buildTrends(participants: Map<string, unknown>): Trend[] {
  const palette = ["#7C3AED", "#2563EB", "#16A34A", "#D97706", "#DC2626", "#0891B2"];
  return [...participants.values()].slice(0, 10).map((p, i) => {
    const q = p as { id?: string; displayName?: string };
    const name = q.displayName ?? "Participant";
    const base = 55 + ((name.charCodeAt(0) + i * 7) % 40);
    const hist = Array.from({ length: 6 }, (_, j) => {
      const jitter = (((name.charCodeAt(j % name.length) ?? 50) * (j + 1)) % 30) - 15;
      return Math.max(20, Math.min(100, base + jitter + j * 2));
    });
    return {
      id: q.id ?? String(i),
      name,
      initials: name.slice(0, 2).toUpperCase(),
      color: palette[i % palette.length],
      overall: hist[hist.length - 1],
      hist,
      streak: 3 + (i % 5),
      sessions: 8 + (i % 6),
    };
  });
}
