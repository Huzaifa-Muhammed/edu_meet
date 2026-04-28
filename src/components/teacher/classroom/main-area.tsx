"use client";

import { useEffect, useMemo, useState } from "react";
import { useMeeting, usePubSub } from "@videosdk.live/react-sdk";
import { VideoStage } from "./video-stage";
import { StudentsPane } from "./students-pane";
import { QuestionsPane } from "./questions-pane";
import { BreakoutPane } from "./breakout-pane";
import { Whiteboard } from "./whiteboard";
import { VideoControlBar } from "./video-control-bar";
import {
  AiHighlightsStrip,
  type RaisedHand,
  type ActiveReaction,
} from "./ai-highlights-strip";
import { SlidePresenter } from "./slide-presenter";
import { FreezeAnnotate } from "./freeze-annotate";
import { LaserPointer } from "./laser-pointer";
import { CalculatorOverlay } from "./calculator-overlay";

type Tab = "video" | "questions" | "students" | "breakout";

export function MainArea({
  classroomId,
  meetingId,
  isMod,
  whiteboardOn,
  setWhiteboardOn,
  pointerOn,
  calcOpen,
  setCalcOpen,
  onMuteAll,
  onCamOff,
  onEnd,
}: {
  classroomId: string;
  meetingId: string;
  isMod: boolean;
  whiteboardOn: boolean;
  setWhiteboardOn: (v: boolean) => void;
  pointerOn: boolean;
  calcOpen: boolean;
  setCalcOpen: (v: boolean) => void;
  onMuteAll?: () => void;
  onCamOff?: () => void;
  onEnd?: () => void;
}) {
  const [tab, setTab] = useState<Tab>("video");
  const [slidesOn, setSlidesOn] = useState(false);
  const [handsClearedAt, setHandsClearedAt] = useState<number>(0);
  const { participants } = useMeeting();

  const { messages: handMsgs } = usePubSub("HAND_RAISE");
  const { publish: publishLowerAll } = usePubSub("LOWER_HANDS");

  const hands = useMemo<RaisedHand[]>(() => {
    const latest = new Map<string, RaisedHand & { raised: boolean }>();
    for (const m of handMsgs) {
      try {
        const p = JSON.parse(m.message as unknown as string) as {
          uid: string;
          name: string;
          state: "raised" | "lowered";
          at: number;
        };
        if (p.at <= handsClearedAt) continue;
        const prev = latest.get(p.uid);
        if (prev && prev.at >= p.at) continue;
        latest.set(p.uid, {
          uid: p.uid,
          name: p.name,
          at: p.at,
          raised: p.state === "raised",
        });
      } catch {
        // skip malformed
      }
    }
    return [...latest.values()]
      .filter((h) => h.raised)
      .map(({ uid, name, at }) => ({ uid, name, at }))
      .sort((a, b) => a.at - b.at);
  }, [handMsgs, handsClearedAt]);

  const onLowerHands = () => {
    publishLowerAll(String(Date.now()), { persist: false });
    setHandsClearedAt(Date.now());
  };

  // ── Live student reactions (Confused / Got it) ─────────────────
  // Keep latest per (uid + type). A student can be both confused on one
  // topic and "got it" on another, so we don't collapse types together.
  // Active reactions auto-expire after 90s if not refreshed.
  const REACTION_TTL_MS = 90_000;
  const [reactionTick, setReactionTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setReactionTick((t) => t + 1), 15_000);
    return () => clearInterval(id);
  }, []);

  const { messages: reactionMsgs } = usePubSub("REACTION");
  const reactions = useMemo<ActiveReaction[]>(() => {
    const now = Date.now();
    const latest = new Map<
      string,
      { uid: string; name: string; type: "ok" | "confused"; state: string; at: number }
    >();
    for (const m of reactionMsgs) {
      try {
        const p = JSON.parse(m.message as unknown as string) as {
          uid: string;
          name: string;
          type: "ok" | "confused";
          state?: "active" | "cleared";
          at: number;
        };
        if (!p.uid || !p.type) continue;
        const key = `${p.uid}:${p.type}`;
        const prev = latest.get(key);
        if (prev && prev.at >= p.at) continue;
        latest.set(key, {
          uid: p.uid,
          name: p.name ?? "Student",
          type: p.type,
          state: p.state ?? "active",
          at: p.at,
        });
      } catch {
        // skip
      }
    }
    return [...latest.values()]
      .filter((r) => r.state === "active" && now - r.at < REACTION_TTL_MS)
      .map(({ uid, name, type, at }) => ({ uid, name, type, at }))
      .sort((a, b) => a.at - b.at);
    // reactionTick keeps the TTL filter live without depending on messages
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reactionMsgs, reactionTick]);

  // If container tab switches away and back, participant handshakes keep state
  useEffect(() => {
    // no-op — placeholder for future cleanup
  }, [tab]);

  return (
    <main
      className="relative z-[5] flex flex-1 flex-col overflow-hidden bg-surf"
      style={{
        boxShadow:
          "0 0 0 1px var(--bd), 4px 0 24px rgba(0,0,0,.08), -4px 0 24px rgba(0,0,0,.08)",
      }}
    >
      {/* Tabs */}
      <div className="flex flex-shrink-0 border-b-2 border-bd bg-surf px-3">
        <TabBtn on={tab === "video"} onClick={() => setTab("video")} label="Video" />
        <TabBtn
          on={tab === "questions"}
          onClick={() => setTab("questions")}
          label="Questions"
        />
        <TabBtn
          on={tab === "students"}
          onClick={() => setTab("students")}
          label="Students"
          badge={participants.size}
        />
        <TabBtn
          on={tab === "breakout"}
          onClick={() => setTab("breakout")}
          label="Breakout Rooms"
        />
      </div>

      {/* Video — scrollable so AI Highlights, etc. reachable even on short screens.
          Video/whiteboard/slides/calculator overlay container has a generous
          min-height so the calculator renders at a usable size. */}
      {tab === "video" && (
        <div className="flex flex-1 flex-col overflow-y-auto">
          <div
            className="relative flex-shrink-0 p-2.5 pb-4"
            style={{ height: 545 }}
          >
            <LaserPointer active={pointerOn} canEdit={isMod}>
              <FreezeAnnotate>
                <VideoStage />
              </FreezeAnnotate>
              <Whiteboard
                active={whiteboardOn}
                canEdit={isMod}
                onClose={() => setWhiteboardOn(false)}
              />
              {slidesOn && (
                <SlidePresenter
                  meetingId={meetingId}
                  canEdit={isMod}
                  onClose={() => setSlidesOn(false)}
                />
              )}
              <CalculatorOverlay
                open={calcOpen}
                canEdit={isMod}
                onClose={() => setCalcOpen(false)}
              />
            </LaserPointer>
          </div>
          <VideoControlBar
            boardOn={whiteboardOn}
            slidesOn={slidesOn}
            onBoard={() => setWhiteboardOn(!whiteboardOn)}
            onSlides={() => setSlidesOn((v) => !v)}
            onMuteAll={onMuteAll}
            onCamOff={onCamOff}
            onLowerHands={onLowerHands}
            handsCount={hands.length}
            onEnd={onEnd}
          />
          <AiHighlightsStrip
            classroomId={classroomId}
            hands={hands}
            reactions={reactions}
            participantCount={participants.size}
          />
        </div>
      )}

      {tab === "questions" && <QuestionsPane classroomId={classroomId} />}
      {tab === "students" && (
        <StudentsPane classroomId={classroomId} meetingId={meetingId} />
      )}
      {tab === "breakout" && (
        <BreakoutPane meetingId={meetingId} classroomId={classroomId} />
      )}
    </main>
  );
}

function TabBtn({
  on,
  onClick,
  label,
  badge,
}: {
  on: boolean;
  onClick: () => void;
  label: string;
  badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`-mb-[2px] flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-[11px] transition-colors ${
        on
          ? "border-blue font-semibold text-blue"
          : "border-transparent font-medium text-t3 hover:text-t2"
      }`}
    >
      {label}
      {badge != null && (
        <span className="rounded-full bg-panel2 px-1.5 text-[9px] text-t3">{badge}</span>
      )}
    </button>
  );
}
