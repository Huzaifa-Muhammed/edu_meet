"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMeeting, usePubSub } from "@videosdk.live/react-sdk";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import api from "@/lib/api/client";
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
  type RejoinRequest,
} from "./ai-highlights-strip";
import { SlidePresenter } from "./slide-presenter";
import { FreezeAnnotate } from "./freeze-annotate";
import { LaserPointer } from "./laser-pointer";
import { CalculatorOverlay } from "./calculator-overlay";
import { LiveCaptions } from "@/components/shared/live-captions";

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

  // ── Rejoin requests from previously-banned students ──────────────
  // Polled every 10s. The classroom tab is always open while teaching, so
  // polling is fine (and matches the AI Highlights cadence). When a NEW
  // uid appears in the list, fire a toast.
  const qc = useQueryClient();
  const seenRejoinIdsRef = useRef<Set<string>>(new Set());
  const rejoinInitializedRef = useRef(false);
  const { data: rejoinRequests = [] } = useQuery<RejoinRequest[]>({
    queryKey: ["rejoin-requests", meetingId],
    queryFn: () =>
      api.get(
        `/meetings/${meetingId}/rejoin-requests`,
      ) as unknown as Promise<RejoinRequest[]>,
    enabled: !!meetingId,
    refetchInterval: 10_000,
  });

  useEffect(() => {
    const seen = seenRejoinIdsRef.current;
    const isFirstRun = !rejoinInitializedRef.current;
    for (const r of rejoinRequests) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      // Skip toast on first hydration so reloading the page doesn't
      // re-pop notifications for already-known pending requests.
      if (isFirstRun) continue;
      toast.info(`${r.name} is asking to rejoin the class`, {
        duration: 8000,
      });
    }
    rejoinInitializedRef.current = true;
  }, [rejoinRequests]);

  const rejoinMut = useMutation({
    mutationFn: ({ uid, action }: { uid: string; action: "approve" | "deny" }) =>
      api.post(`/meetings/${meetingId}/rejoin-requests`, { uid, action }),
    onSuccess: (_data, { uid, action }) => {
      const target = rejoinRequests.find((r) => r.uid === uid);
      const name = target?.name ?? "Student";
      toast.success(
        action === "approve" ? `${name} can rejoin` : `${name}'s request declined`,
      );
      qc.invalidateQueries({ queryKey: ["rejoin-requests", meetingId] });
    },
    onError: (err: Error) =>
      toast.error(err.message ?? "Could not update request"),
  });

  const onApproveRejoin = (uid: string) =>
    rejoinMut.mutate({ uid, action: "approve" });
  const onDenyRejoin = (uid: string) =>
    rejoinMut.mutate({ uid, action: "deny" });

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
          {rejoinRequests.length > 0 && (
            <RejoinRequestsBanner
              requests={rejoinRequests}
              onApprove={onApproveRejoin}
              onDeny={onDenyRejoin}
              busy={rejoinMut.isPending}
            />
          )}
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
            <LiveCaptions />
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
            rejoinRequests={rejoinRequests}
            onApproveRejoin={onApproveRejoin}
            onDenyRejoin={onDenyRejoin}
            rejoinBusy={rejoinMut.isPending}
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

function RejoinRequestsBanner({
  requests,
  onApprove,
  onDeny,
  busy,
}: {
  requests: RejoinRequest[];
  onApprove: (uid: string) => void;
  onDeny: (uid: string) => void;
  busy: boolean;
}) {
  return (
    <div
      className="flex flex-shrink-0 flex-col gap-1.5 border-b border-amber-300 px-3 py-2"
      style={{
        background:
          "linear-gradient(90deg, rgba(254,243,199,0.95), rgba(254,249,195,0.95))",
      }}
    >
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[.4px] text-amber-900">
          🚪 Rejoin requests
        </span>
        <span className="text-[10px] text-amber-800/80">
          {requests.length} student{requests.length === 1 ? "" : "s"} waiting to come back
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {requests.map((r) => (
          <div
            key={r.id}
            className="flex items-center gap-2 rounded-full border border-amber-300 bg-white/80 px-2.5 py-1 text-[11px]"
          >
            <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-amber-200 text-[9px] font-bold text-amber-900">
              {r.name.slice(0, 2).toUpperCase()}
            </div>
            <span className="font-medium text-amber-900">{r.name}</span>
            <span className="text-amber-800/70">wants to rejoin</span>
            <button
              onClick={() => onApprove(r.uid)}
              disabled={busy}
              className="ml-1 inline-flex h-5 items-center gap-1 rounded-full bg-green-600 px-2 text-[10px] font-semibold text-white hover:bg-green-700 disabled:opacity-50"
              title="Approve and unban"
            >
              <Check className="h-2.5 w-2.5" /> Approve
            </button>
            <button
              onClick={() => onDeny(r.uid)}
              disabled={busy}
              className="inline-flex h-5 items-center gap-1 rounded-full border border-red-300 bg-red-50 px-2 text-[10px] font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
              title="Decline — student stays banned"
            >
              <X className="h-2.5 w-2.5" /> Deny
            </button>
          </div>
        ))}
      </div>
    </div>
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
