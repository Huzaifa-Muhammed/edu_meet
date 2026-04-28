"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMeeting, usePubSub } from "@videosdk.live/react-sdk";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import api from "@/lib/api/client";
import { useAuth } from "@/providers/auth-provider";

type Tab = "feed" | "quiz" | "progress" | "chat" | "wallet" | "classmates";

type ChatMsg = {
  id: string;
  senderName?: string;
  senderRole?: string;
  senderUid?: string;
  text: string;
  createdAt: string;
  clientId?: string;
};

type QuizQ = {
  id: string;
  text: string;
  options?: string[];
  correctIndex?: number;
  openedAt: number;
  code?: string;
  difficulty?: "easy" | "medium" | "hard";
};

type Student = {
  uid: string;
  displayName?: string;
  email?: string;
};

type FeedKind = "alert" | "info" | "success" | "quiz";

type FeedItem = {
  id: string;
  kind: FeedKind;
  title: string;
  text: string;
  action?: { label: string; onClick: () => void };
  time: string;
  timeLabel: string;
};

type WalletResp = {
  tokens: {
    balance: number;
    earnedTotal: number;
    weekEarned: number;
    streakDays: number;
  };
  histogram: { date: string; value: number }[];
};

type ProgressResp = {
  correct: number;
  answered: number;
  pct: number;
  overallPct: number;
  streakDays: number;
  rank: number | null;
  totalClassmates: number;
  questions: {
    num: number;
    title: string;
    pct: number;
    status: "correct" | "wrong" | "partial" | "pending";
  }[];
};

type SocialResp = {
  classmates: { uid: string; displayName?: string; email?: string }[];
  leaderboard: { uid: string; displayName?: string; email?: string; weekEarned: number }[];
  me: { uid: string };
};

const TAB_TITLES: Record<Tab, string> = {
  feed: "📢 Class Feed",
  quiz: "📝 Live Quiz",
  progress: "📈 My Progress",
  chat: "💬 Class Chat",
  wallet: "🪙 Brain Token Wallet",
  classmates: "👥 Class",
};

export function StudentRightPanel({
  classroomId,
  meetingId,
}: {
  classroomId: string;
  meetingId: string;
  teacherId?: string;
}) {
  const [tab, setTab] = useState<Tab>("feed");
  const [collapsed, setCollapsed] = useState(false);

  // Badge counters
  const { messages: qMsgs } = usePubSub("QUIZ_Q");
  const { messages: qEndMsgs } = usePubSub("QUIZ_Q_END");
  const liveQuizOpen = useMemo(() => {
    const last = qMsgs[qMsgs.length - 1];
    if (!last) return false;
    try {
      const q = JSON.parse(last.message as unknown as string) as { id: string };
      const endedIds = new Set(
        qEndMsgs
          .map((m) => {
            try {
              return (JSON.parse(m.message as unknown as string) as { id: string }).id;
            } catch {
              return String(m.message);
            }
          }),
      );
      return !endedIds.has(q.id);
    } catch {
      return false;
    }
  }, [qMsgs.length, qEndMsgs.length]);

  const TABS: { id: Tab; label: React.ReactNode }[] = [
    { id: "feed", label: "Feed" },
    {
      id: "quiz",
      label: (
        <>
          Quiz
          {liveQuizOpen && (
            <span
              style={{
                marginLeft: 4,
                background: "#D63B3B",
                color: "white",
                fontSize: 8,
                padding: "1px 5px",
                borderRadius: 8,
                verticalAlign: "middle",
              }}
            >
              New
            </span>
          )}
        </>
      ),
    },
    { id: "progress", label: "Progress" },
    { id: "chat", label: "Chat" },
    { id: "wallet", label: "🪙 Wallet" },
    { id: "classmates", label: "👥 Class" },
  ];

  return (
    <aside className={`rp${collapsed ? " collapsed" : ""}`}>
      <div className="rp-header">
        <span className="rp-header-title">{TAB_TITLES[tab]}</span>
        <div
          className="rp-toggle"
          onClick={() => setCollapsed((v) => !v)}
          title={collapsed ? "Expand" : "Collapse"}
        >
          {collapsed ? "◀" : "▶"}
        </div>
      </div>
      <div className="rp-tabs">
        {TABS.map((t) => (
          <div
            key={t.id}
            className={`rpt${tab === t.id ? " on" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </div>
        ))}
      </div>

      <div className={`rp-pane${tab === "feed" ? " on" : ""}`}>
        <FeedTab onSwitchTab={setTab} />
      </div>
      <div className={`rp-pane${tab === "quiz" ? " on" : ""}`}>
        <QuizTab meetingId={meetingId} />
      </div>
      <div className={`rp-pane${tab === "progress" ? " on" : ""}`}>
        <ProgressTab meetingId={meetingId} />
      </div>
      <div className={`rp-pane${tab === "chat" ? " on" : ""}`}>
        <ChatTab classroomId={classroomId} meetingId={meetingId} />
      </div>
      <div className={`rp-pane${tab === "wallet" ? " on" : ""}`}>
        <WalletTab />
      </div>
      <div className={`rp-pane${tab === "classmates" ? " on" : ""}`}>
        <ClassmatesTab classroomId={classroomId} />
      </div>
    </aside>
  );
}

/* ─────────── Feed ─────────── */

function relTime(isoOrMs: string | number) {
  const ms = typeof isoOrMs === "number" ? isoOrMs : new Date(isoOrMs).getTime();
  const diff = Date.now() - ms;
  if (diff < 60_000) return "now";
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)}h`;
  return `${Math.round(diff / 86_400_000)}d`;
}

function FeedTab({ onSwitchTab }: { onSwitchTab: (t: Tab) => void }) {
  const { messages: qMsgs } = usePubSub("QUIZ_Q");
  const { messages: rewardMsgs } = usePubSub("REWARD");
  const { messages: discussMsgs } = usePubSub("QUESTION_DISCUSS");
  const { messages: slideMsgs } = usePubSub("SLIDE");
  const { messages: wbMsgs } = usePubSub("WHITEBOARD");

  const items: FeedItem[] = useMemo(() => {
    const list: FeedItem[] = [];

    for (const m of qMsgs) {
      try {
        const q = JSON.parse(m.message as unknown as string) as QuizQ;
        list.push({
          id: `q_${q.id}`,
          kind: "quiz",
          title: "New quiz question",
          text: q.text,
          action: {
            label: "Answer now",
            onClick: () => onSwitchTab("quiz"),
          },
          time: new Date(q.openedAt).toISOString(),
          timeLabel: relTime(q.openedAt),
        });
      } catch {}
    }

    for (const m of rewardMsgs) {
      try {
        const p = JSON.parse(m.message as unknown as string) as {
          name: string;
          rewardLabel: string;
          rewardEmoji: string;
          note: string;
        };
        const t = m.timestamp ? new Date(m.timestamp).getTime() : Date.now();
        list.push({
          id: `r_${m.timestamp ?? Math.random()}`,
          kind: "success",
          title: `${p.rewardEmoji} ${p.name} got ${p.rewardLabel}`,
          text: p.note || "Great work!",
          time: new Date(t).toISOString(),
          timeLabel: relTime(t),
        });
      } catch {}
    }

    for (const m of discussMsgs) {
      try {
        const p = JSON.parse(m.message as unknown as string) as { text: string };
        const t = m.timestamp ? new Date(m.timestamp).getTime() : Date.now();
        list.push({
          id: `d_${m.timestamp ?? Math.random()}`,
          kind: "info",
          title: "Teacher is discussing a question",
          text: p.text,
          time: new Date(t).toISOString(),
          timeLabel: relTime(t),
        });
      } catch {}
    }

    if (slideMsgs.length > 0) {
      const last = slideMsgs[slideMsgs.length - 1];
      const t = last.timestamp ? new Date(last.timestamp).getTime() : Date.now();
      list.push({
        id: `s_${last.timestamp ?? Math.random()}`,
        kind: "info",
        title: "Teacher is sharing slides",
        text: "Follow along in the main panel.",
        time: new Date(t).toISOString(),
        timeLabel: relTime(t),
      });
    }

    if (wbMsgs.length > 0) {
      const last = wbMsgs[wbMsgs.length - 1];
      const t = last.timestamp ? new Date(last.timestamp).getTime() : Date.now();
      list.push({
        id: `wb_${last.timestamp ?? Math.random()}`,
        kind: "info",
        title: "Teacher is on the whiteboard",
        text: "The whiteboard overlay is open on the main stage.",
        time: new Date(t).toISOString(),
        timeLabel: relTime(t),
      });
    }

    list.sort((a, b) => b.time.localeCompare(a.time));
    return list;
  }, [qMsgs.length, rewardMsgs.length, discussMsgs.length, slideMsgs.length, wbMsgs.length, onSwitchTab]);

  return (
    <div className="feed-scroll">
      {items.length === 0 ? (
        <>
          <div className="feed-item info">
            <div className="feed-hdr">
              <span className="feed-title">Welcome to class!</span>
              <span className="feed-time">now</span>
            </div>
            <div className="feed-text">
              Activity will appear here as your teacher runs the session — quiz
              pushes, announcements, and reward broadcasts.
            </div>
          </div>
          <div className="feed-item quiz">
            <div className="feed-hdr">
              <span className="feed-title">Quiz tab is ready</span>
              <span className="feed-time">—</span>
            </div>
            <div className="feed-text">
              Live questions from the teacher will show up here and in the Quiz tab.
            </div>
            <button className="feed-action" onClick={() => onSwitchTab("quiz")}>
              Open Quiz tab →
            </button>
          </div>
          <div className="feed-item success">
            <div className="feed-hdr">
              <span className="feed-title">Tip · Ask a question</span>
              <span className="feed-time">—</span>
            </div>
            <div className="feed-text">
              Use the hand-raise button in the topbar, or type a question in the
              Chat tab — your teacher will see it instantly.
            </div>
          </div>
        </>
      ) : (
        items.map((f) => (
          <div key={f.id} className={`feed-item ${f.kind}`}>
            <div className="feed-hdr">
              <span className="feed-title">{f.title}</span>
              <span className="feed-time">{f.timeLabel}</span>
            </div>
            <div className="feed-text">{f.text}</div>
            {f.action && (
              <button className="feed-action" onClick={f.action.onClick}>
                {f.action.label} →
              </button>
            )}
          </div>
        ))
      )}
    </div>
  );
}

/* ─────────── Quiz ─────────── */

function QuizTab({ meetingId }: { meetingId: string }) {
  const { publish: publishAnswer, messages: aMsgs } = usePubSub("QUIZ_A");
  const { messages: qMsgs } = usePubSub("QUIZ_Q");
  const { messages: endMsgs } = usePubSub("QUIZ_Q_END");
  const { user } = useAuth();

  const latestQ = useMemo<QuizQ | null>(() => {
    const last = qMsgs[qMsgs.length - 1];
    if (!last) return null;
    try {
      return JSON.parse(last.message as unknown as string) as QuizQ;
    } catch {
      return null;
    }
  }, [qMsgs.length]);

  const endedIds = useMemo(() => {
    const set = new Set<string>();
    for (const m of endMsgs) {
      try {
        const p = JSON.parse(m.message as unknown as string) as { id: string };
        set.add(p.id);
      } catch {
        set.add(String(m.message));
      }
    }
    return set;
  }, [endMsgs.length]);

  const ended = latestQ ? endedIds.has(latestQ.id) : false;
  const [picked, setPicked] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [pctLeft, setPctLeft] = useState(100);

  useEffect(() => {
    if (!latestQ) return;
    setPicked(null);
    setSubmitted(false);
    for (const m of aMsgs) {
      try {
        const p = JSON.parse(m.message as unknown as string) as {
          qid: string;
          uid: string;
          index: number;
        };
        if (p.qid === latestQ.id && p.uid === user?.uid) {
          setPicked(p.index);
          setSubmitted(true);
          break;
        }
      } catch {}
    }
  }, [latestQ?.id, aMsgs.length, user?.uid]);

  useEffect(() => {
    if (!latestQ || ended) {
      setPctLeft(0);
      return;
    }
    const DURATION = 60_000;
    const tick = () => {
      const remaining = Math.max(0, DURATION - (Date.now() - latestQ.openedAt));
      setPctLeft((remaining / DURATION) * 100);
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [latestQ, ended]);

  if (!latestQ) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, color: "#8A9BAD" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 6 }}>💭</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#4A5C6E" }}>
            No live quiz yet
          </div>
          <div style={{ fontSize: 11, marginTop: 4, lineHeight: 1.55, maxWidth: 260 }}>
            Your teacher will push a question here when it&apos;s time.
          </div>
        </div>
      </div>
    );
  }

  const submit = () => {
    if (picked == null) return;
    publishAnswer(
      JSON.stringify({
        qid: latestQ.id,
        uid: user?.uid,
        name: user?.displayName,
        meetingId,
        index: picked,
        at: Date.now(),
      }),
      { persist: true },
    );
    setSubmitted(true);
  };

  const diff = latestQ.difficulty ?? "medium";
  const isCorrect = ended && picked === latestQ.correctIndex;

  return (
    <>
      <div className="quiz-timer-bar">
        <div className="quiz-timer-fill" style={{ width: `${pctLeft}%` }} />
      </div>
      <div className="quiz-area">
        <div className="quiz-card">
          <div className="quiz-card-hdr">
            <span className="quiz-q-num">Q</span>
            <p className="quiz-q-text">{latestQ.text}</p>
            <span className={`quiz-diff ${diff}`}>{diff}</span>
            {!ended && <span className="quiz-live-chip">⚡ Live</span>}
          </div>
          {latestQ.code && <div className="quiz-code">{latestQ.code}</div>}

          {latestQ.options && latestQ.options.length > 0 && (
            <div className="quiz-opts">
              {latestQ.options.map((opt, idx) => {
                const isPicked = picked === idx;
                const cls = [
                  "qopt",
                  submitted && !ended ? "locked" : "",
                  ended && idx === latestQ.correctIndex ? "correct" : "",
                  ended && isPicked && idx !== latestQ.correctIndex ? "wrong" : "",
                  !ended && isPicked ? "selected" : "",
                ]
                  .filter(Boolean)
                  .join(" ");
                return (
                  <div
                    key={idx}
                    className={cls}
                    onClick={() => !submitted && !ended && setPicked(idx)}
                  >
                    <span className="opt-bubble">{String.fromCharCode(65 + idx)}</span>
                    <span className="opt-txt">{opt}</span>
                  </div>
                );
              })}
            </div>
          )}

          <div className="quiz-footer">
            {ended ? (
              <span className={`result-pill ${isCorrect ? "correct" : picked != null ? "wrong" : "pending"}`}>
                {isCorrect
                  ? "✓ Correct"
                  : picked != null
                    ? "✗ Not quite"
                    : "⏳ Not answered"}
              </span>
            ) : (
              <>
                <button
                  className="submit-btn"
                  onClick={submit}
                  disabled={picked == null || submitted}
                >
                  {submitted ? "Submitted" : "Submit"}
                </button>
                <span className="quiz-hint">
                  {submitted ? "Waiting for reveal" : "Pick your answer"}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

/* ─────────── Progress ─────────── */

function ProgressTab({ meetingId }: { meetingId: string }) {
  const q = useQuery<ProgressResp>({
    queryKey: ["class-progress", meetingId],
    queryFn: () =>
      api.get(`/student/class-progress/${meetingId}`) as unknown as Promise<ProgressResp>,
    refetchInterval: 30_000,
  });
  const data = q.data;

  return (
    <div className="prog-pane">
      <div className="my-score-card">
        <div className="msc-deco">📐</div>
        <div className="msc-label">Your session score</div>
        <div className="msc-score">
          {data?.pct ?? 0}
          <span style={{ fontSize: 18, fontWeight: 400, color: "rgba(255,255,255,.4)" }}>
            %
          </span>
        </div>
        <div className="msc-sub">
          {data?.correct ?? 0} of {data?.answered ?? 0} answered correctly
        </div>
        <div className="msc-badges">
          <div className="msc-badge">🔥 {data?.streakDays ?? 0} day streak</div>
          {data?.rank != null && (
            <div className="msc-badge">📚 Rank {data.rank} of {data.totalClassmates}</div>
          )}
          <div className="msc-badge">⭐ {data?.overallPct ?? 0}% overall</div>
        </div>
      </div>

      {data && data.questions.length > 0 && (
        <>
          <div className="prog-section">Question results</div>
          {data.questions.map((qn) => {
            const bg =
              qn.status === "pending"
                ? "#E8EFF7"
                : qn.status === "correct"
                  ? "#E8FAF2"
                  : qn.status === "wrong"
                    ? "#FDEAEA"
                    : "#E6F2FB";
            const bd =
              qn.status === "pending"
                ? "#A8BAD0"
                : qn.status === "correct"
                  ? "#7EDBB5"
                  : qn.status === "wrong"
                    ? "#F0AAAA"
                    : "#90C8EE";
            const col =
              qn.status === "pending"
                ? "#8A9BAD"
                : qn.status === "correct"
                  ? "#0B7A49"
                  : qn.status === "wrong"
                    ? "#A02828"
                    : "#135E9A";
            return (
              <div key={qn.num} className="qr-row">
                <div
                  className="qr-num"
                  style={{ background: bg, borderColor: bd }}
                >
                  {qn.num}
                </div>
                <div className="qr-txt">{qn.title}</div>
                <div className="qr-ans" style={{ color: col }}>
                  {qn.status === "correct"
                    ? `✓ ${qn.pct}%`
                    : qn.status === "wrong"
                      ? `✗ ${qn.pct}%`
                      : qn.status === "partial"
                        ? `${qn.pct}%`
                        : "Pending"}
                </div>
              </div>
            );
          })}
        </>
      )}

      <div className="prog-section">Achievements</div>
      <div className="streak-card">
        <div className="streak-ico">🔥</div>
        <div>
          <div className="streak-val">{data?.streakDays ?? 0}</div>
          <div className="streak-lbl">day streak</div>
        </div>
        <div style={{ marginLeft: "auto", fontSize: 11, color: "#8A9BAD" }}>
          Keep it up!
        </div>
      </div>
      <div className="badges-grid">
        {[
          { ico: "⭐", lbl: "First answer", locked: (data?.answered ?? 0) === 0 },
          { ico: "🎯", lbl: "Perfect score", locked: (data?.pct ?? 0) < 100 || (data?.answered ?? 0) === 0 },
          { ico: "⚡", lbl: "Speed solver", locked: true },
          { ico: "🏆", lbl: "Top of class", locked: (data?.rank ?? 99) > 1 },
          { ico: "🔥", lbl: "5-day streak", locked: (data?.streakDays ?? 0) < 5 },
          { ico: "💡", lbl: "Curious learner", locked: false },
          { ico: "📚", lbl: "Note taker", locked: false },
          { ico: "🤝", lbl: "Team player", locked: true },
        ].map((b) => (
          <div key={b.lbl} className={`badge-item${b.locked ? " locked" : ""}`}>
            <div className="badge-ico">{b.ico}</div>
            <div className="badge-lbl">{b.lbl}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────── Chat ─────────── */

function ChatTab({
  classroomId,
  meetingId,
}: {
  classroomId: string;
  meetingId: string;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [askMode, setAskMode] = useState(false);

  const history = useQuery<ChatMsg[]>({
    queryKey: ["class-chat", classroomId],
    queryFn: () =>
      api.get(`/classrooms/${classroomId}/chat`) as unknown as Promise<ChatMsg[]>,
    refetchInterval: 20_000,
  });

  const { publish, messages: pubMsgs } = usePubSub("CHAT");
  const { publish: publishNewQuestion } = usePubSub("NEW_QUESTION");
  const [live, setLive] = useState<ChatMsg[]>([]);

  useEffect(() => {
    const fresh: ChatMsg[] = [];
    for (const m of pubMsgs) {
      try {
        const p = JSON.parse(m.message as unknown as string) as ChatMsg;
        fresh.push(p);
      } catch {}
    }
    setLive(fresh);
  }, [pubMsgs.length]);

  const merged = useMemo(() => {
    // Firestore (history) is authoritative; we only show live pubsub
    // messages whose clientId hasn't shown up in Firestore yet. Falls
    // back to (senderUid + text + createdAt-second) if older messages
    // lack a clientId.
    const seenClient = new Set<string>();
    const seenFingerprint = new Set<string>();
    const fp = (m: ChatMsg) =>
      `${m.senderUid ?? ""}|${m.text}|${m.createdAt.slice(0, 19)}`;

    const list: ChatMsg[] = [];
    for (const m of history.data ?? []) {
      if (m.clientId) seenClient.add(m.clientId);
      seenFingerprint.add(fp(m));
      list.push(m);
    }
    for (const m of live) {
      if (m.clientId && seenClient.has(m.clientId)) continue;
      if (seenFingerprint.has(fp(m))) continue;
      list.push(m);
    }
    list.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return list;
  }, [history.data, live]);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [merged.length]);

  async function send() {
    const t = text.trim();
    if (!t) return;
    setText("");
    const clientId = crypto.randomUUID();
    const msg: ChatMsg = {
      id: clientId,
      clientId,
      senderUid: user?.uid,
      senderName: user?.displayName ?? "Student",
      senderRole: "student",
      text: t,
      createdAt: new Date().toISOString(),
    };
    publish(JSON.stringify(msg), { persist: true });
    try {
      await api.post(`/classrooms/${classroomId}/chat`, { text: t, clientId });
      qc.invalidateQueries({ queryKey: ["class-chat", classroomId] });
    } catch {
      // pubsub still delivered the message
    }
  }

  /** Files the current draft as a question — posts to the questions
   *  collection (so it shows up in the teacher's Questions tab + AI
   *  Highlights), publishes NEW_QUESTION for instant teacher refetch,
   *  and also drops the message into chat so peers see what was asked. */
  async function askTeacher() {
    const t = text.trim();
    if (!t) {
      setAskMode(true);
      toast.info("Type your question, then click Ask teacher");
      return;
    }
    setText("");
    setAskMode(false);

    const clientId = crypto.randomUUID();
    const chatMsg: ChatMsg = {
      id: clientId,
      clientId,
      senderUid: user?.uid,
      senderName: user?.displayName ?? "Student",
      senderRole: "student",
      text: `❓ ${t}`,
      createdAt: new Date().toISOString(),
    };
    publish(JSON.stringify(chatMsg), { persist: true });

    try {
      // 1) durable question for the teacher's Questions tab
      await api.post(`/classrooms/${classroomId}/questions`, {
        text: t,
        meetingId,
      });
      // 2) chat mirror so peers see the message in conversation flow
      api
        .post(`/classrooms/${classroomId}/chat`, {
          text: `❓ ${t}`,
          clientId,
          meetingId,
        })
        .catch(() => undefined);
      // 3) realtime nudge — teacher's AI Highlights + Questions tab refetch
      publishNewQuestion(
        JSON.stringify({ uid: user?.uid, name: user?.displayName, at: Date.now() }),
        { persist: false },
      );
      qc.invalidateQueries({ queryKey: ["class-chat", classroomId] });
      toast.success("Question sent to teacher");
    } catch (err) {
      console.error("[ask teacher]", err);
      toast.error(
        err instanceof Error ? err.message : "Could not send question",
      );
    }
  }

  const initials = (m: ChatMsg) => {
    const n = m.senderName ?? "?";
    return n
      .split(/[\s@.]+/)
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  return (
    <div className="chat-pane">
      <div ref={scrollRef} className="chat-msgs">
        {merged.length === 0 ? (
          <p style={{ textAlign: "center", fontSize: 11, color: "#8A9BAD", padding: 16 }}>
            Class chat is quiet. Say hi!
          </p>
        ) : (
          merged.map((m) => {
            const mine = m.senderUid === user?.uid;
            const teacher = m.senderRole === "teacher";
            return (
              <div key={m.id} className={`msg-row${mine ? " mine" : ""}`}>
                <div
                  className="msg-av"
                  style={
                    mine
                      ? { background: "#1A7EC8", color: "white" }
                      : teacher
                        ? { background: "#F0EAFA", border: "1px solid #C4A8ED", color: "#4E2E9A" }
                        : { background: "#DBEAFE", color: "#1E40AF" }
                  }
                >
                  {initials(m)}
                </div>
                <div className="msg-body">
                  <div className="msg-name">
                    {mine ? "You" : m.senderName ?? "User"} ·{" "}
                    {format(new Date(m.createdAt), "h:mm a")}
                  </div>
                  <div className={`msg-bubble${teacher ? " msg-teacher" : ""}`}>
                    {m.text}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
      <div className="ask-teacher">
        <span style={{ flex: 1 }}>
          {askMode
            ? "Type your question and click Ask teacher"
            : "Got a question for the teacher?"}
        </span>
        <button className="ask-teacher-btn" onClick={askTeacher}>
          ✋ Ask teacher
        </button>
      </div>
      <div className="chat-bar">
        <input
          className="chat-inp"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (askMode) askTeacher();
              else send();
            }
            if (e.key === "Escape" && askMode) setAskMode(false);
          }}
          placeholder={askMode ? "Type your question for the teacher…" : "Message the class…"}
          style={
            askMode
              ? { borderColor: "#FACC15", boxShadow: "0 0 0 3px rgba(250,204,21,.18)" }
              : undefined
          }
        />
        <button
          className="chat-send"
          onClick={send}
          disabled={!text.trim()}
          aria-label="Send"
        >
          ↑
        </button>
      </div>
    </div>
  );
}

/* ─────────── Wallet ─────────── */

function WalletTab() {
  const q = useQuery<WalletResp>({
    queryKey: ["student", "wallet-full"],
    queryFn: () => api.get("/student/wallet") as unknown as Promise<WalletResp>,
    refetchInterval: 30_000,
  });
  const d = q.data;
  const hist = (d?.histogram ?? []).map((h) => h.value);
  const max = Math.max(1, ...hist);

  return (
    <div className="wt-scroll">
      <div className="wallet-card">
        <div className="wc-lbl">🪙 My Brain Token Wallet</div>
        <div className="wc-bt-row">
          <span className="wc-bt-val">{d?.tokens.balance ?? 0}</span>
          <span className="wc-bt-unit">BT</span>
        </div>
        <div className="wc-stats">
          <div className="wc-stat">
            <div className="wc-sv">+{d?.tokens.weekEarned ?? 0}</div>
            <div className="wc-sl">This week</div>
          </div>
          <div className="wc-stat">
            <div className="wc-sv">🔥 {d?.tokens.streakDays ?? 0}</div>
            <div className="wc-sl">Streak</div>
          </div>
          <div className="wc-stat">
            <div className="wc-sv">{d?.tokens.earnedTotal ?? 0}</div>
            <div className="wc-sl">Lifetime</div>
          </div>
        </div>
        <div className="wc-hist">
          {(d?.histogram ?? []).map((h, i) => {
            const isLast = i === (d?.histogram.length ?? 1) - 1;
            return (
              <div
                key={h.date}
                className={`wc-bar${isLast ? " active" : ""}`}
                style={{
                  height: `${Math.max(8, Math.round((h.value / max) * 100))}%`,
                }}
                title={`${h.date}: +${h.value} BT`}
              />
            );
          })}
        </div>
        <div className="wc-hist-row">
          <span className="wc-hl">2 weeks ago</span>
          <span className="wc-hl">Now</span>
        </div>
      </div>
    </div>
  );
}

/* ─────────── Classmates + Leaderboard ─────────── */

function ClassmatesTab({ classroomId }: { classroomId: string }) {
  const { user } = useAuth();
  const { participants } = useMeeting();
  const [mode, setMode] = useState<"bt" | "pts" | "stars">("bt");

  const socialQ = useQuery<SocialResp>({
    queryKey: ["student", "social"],
    queryFn: () => api.get("/student/social") as unknown as Promise<SocialResp>,
    refetchInterval: 30_000,
  });

  const studentsQ = useQuery<Student[]>({
    queryKey: ["classroom-students", classroomId],
    queryFn: () =>
      api.get(`/classrooms/${classroomId}/students`) as unknown as Promise<Student[]>,
  });

  const rows = (studentsQ.data ?? []).map((s) => ({
    ...s,
    live: participants.has(s.uid),
  }));
  const classmates = rows.filter((r) => r.uid !== user?.uid);

  const initialsOf = (s: { displayName?: string; email?: string }) => {
    const n = s.displayName ?? s.email ?? "?";
    return n
      .split(/[\s@.]+/)
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  const avBg = (uid: string) => {
    const palette = [
      { bg: "#D1FAE5", fg: "#065F46" },
      { bg: "#FEF3C7", fg: "#78350F" },
      { bg: "#FEE2E2", fg: "#7F1D1D" },
      { bg: "#EDE9FE", fg: "#4C1D95" },
      { bg: "#DBEAFE", fg: "#1E40AF" },
      { bg: "#FCE7F3", fg: "#831843" },
    ];
    let h = 0;
    for (const c of uid) h = (h * 31 + c.charCodeAt(0)) | 0;
    return palette[Math.abs(h) % palette.length];
  };

  // Leaderboard rows: use social response + highlight me
  const lbRows = useMemo(() => {
    const data = socialQ.data;
    if (!data) return [];
    const all = [...data.leaderboard];
    const sorted = all.sort((a, b) => {
      if (mode === "bt") return b.weekEarned - a.weekEarned;
      // Reuse weekEarned for pts and stars in the absence of richer data
      return b.weekEarned - a.weekEarned;
    });
    return sorted;
  }, [socialQ.data, mode]);

  const medals = ["🥇", "🥈", "🥉"];

  return (
    <>
      <div className="lb-wrap">
        <div className="lb-head">
          <span className="lb-title">🏆 Leaderboard</span>
          <span className="lb-sub">{rows.length} students</span>
        </div>
        <div className="lb-tabs">
          {(
            [
              { id: "bt", label: "🪙 BT" },
              { id: "pts", label: "Points" },
              { id: "stars", label: "Stars" },
            ] as { id: "bt" | "pts" | "stars"; label: string }[]
          ).map((t) => (
            <div
              key={t.id}
              className={`lb-tab${mode === t.id ? " on" : ""}`}
              onClick={() => setMode(t.id)}
            >
              {t.label}
            </div>
          ))}
        </div>
        {lbRows.length === 0 ? (
          <p style={{ padding: "6px 4px 10px", fontSize: 10, color: "#8A9BAD" }}>
            Nothing to rank yet — start answering questions to climb the leaderboard!
          </p>
        ) : (
          lbRows.slice(0, 8).map((r, i) => {
            const isMe = r.uid === user?.uid;
            const av = avBg(r.uid);
            const rkCls = i === 0 ? " gold" : i === 1 ? " silver" : i === 2 ? " bronze" : "";
            const val = mode === "bt" ? `${r.weekEarned} BT` : `${r.weekEarned} pts`;
            return (
              <div key={r.uid} className={`lb-row${isMe ? " lb-me" : ""}`}>
                <span className={`lb-rk${rkCls}`}>
                  {i < 3 ? medals[i] : i + 1}
                </span>
                <span className="lb-av" style={{ background: av.bg, color: av.fg }}>
                  {initialsOf(r)}
                </span>
                <span className="lb-name">
                  {(r.displayName ?? r.email ?? "Student").split(" ")[0]}
                  {isMe && <span className="lb-you">You</span>}
                </span>
                <span className="lb-val">{val}</span>
              </div>
            );
          })
        )}
      </div>

      <div className="cm-section">
        <div className="cm-section-lbl">👥 Classmates</div>
        <div className="cm-scroll">
          {classmates.length === 0 ? (
            <p style={{ padding: 10, fontSize: 10, color: "#8A9BAD" }}>
              No classmates enrolled yet.
            </p>
          ) : (
            classmates
              .sort((a, b) => (a.live === b.live ? 0 : a.live ? -1 : 1))
              .map((r) => {
                const av = avBg(r.uid);
                return (
                  <div key={r.uid} className="cm-row">
                    <div className="cm-av" style={{ background: av.bg, color: av.fg }}>
                      {initialsOf(r)}
                    </div>
                    <div className="cm-name">
                      {r.displayName ?? r.email ?? "Student"}
                    </div>
                    <div
                      className={`cm-status-dot ${r.live ? "cm-online" : "cm-away"}`}
                    />
                    <div className="cm-score">{r.live ? "●" : "—"}</div>
                  </div>
                );
              })
          )}
        </div>
      </div>
    </>
  );
}
