"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMeeting, useParticipant, usePubSub } from "@videosdk.live/react-sdk";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "@/lib/api/client";
import { useAuth } from "@/providers/auth-provider";
import { Whiteboard } from "@/components/teacher/classroom/whiteboard";
import { LaserPointer } from "@/components/teacher/classroom/laser-pointer";
import { RewardBroadcast, type BroadcastPayload } from "@/components/teacher/classroom/reward-broadcast";
import { CalculatorOverlay } from "@/components/teacher/classroom/calculator-overlay";
import { StudentSlideViewer } from "./student-slide-viewer";
import { GamingPane } from "./gaming-pane";

type QuizQ = {
  id: string;
  text: string;
  options?: string[];
  correctIndex?: number;
  openedAt: number;
  code?: string;
};

const NOTE_TAGS: { id: string; label: string }[] = [
  { id: "all", label: "General" },
  { id: "def", label: "📘 Definition" },
  { id: "method", label: "✅ Method" },
  { id: "question", label: "❓ Question" },
];

export function StudentMainArea({
  classroomId,
  meetingId,
  handRaised,
  setHandRaised,
  toggleHand,
  teacherId,
  teacherName,
  classroomName,
}: {
  classroomId: string;
  meetingId: string;
  handRaised: boolean;
  setHandRaised: React.Dispatch<React.SetStateAction<boolean>>;
  toggleHand: () => void;
  teacherId: string;
  teacherName: string;
  classroomName: string;
}) {
  const { user } = useAuth();
  const { participants } = useMeeting();

  const [whiteboardOpen, setWhiteboardOpen] = useState(false);
  const [slideOpen, setSlideOpen] = useState(false);
  const [calcOpen, setCalcOpen] = useState(false);
  const [confused, setConfused] = useState(false);
  const [gotIt, setGotIt] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [pane, setPane] = useState<"live" | "gaming">("live");

  // ── Pubsub consumers ──
  const { messages: wbMsgs } = usePubSub("WHITEBOARD");
  useEffect(() => {
    if (wbMsgs.length > 0) setWhiteboardOpen(true);
  }, [wbMsgs.length]);

  const { messages: slideMsgs } = usePubSub("SLIDE");
  useEffect(() => {
    if (slideMsgs.length > 0) setSlideOpen(true);
  }, [slideMsgs.length]);

  const { messages: calcOpenMsgs } = usePubSub("CALC_OPEN");
  useEffect(() => {
    const last = calcOpenMsgs[calcOpenMsgs.length - 1];
    if (!last) return;
    try {
      const { open } = JSON.parse(last.message as unknown as string) as { open: boolean };
      setCalcOpen(open);
    } catch {}
  }, [calcOpenMsgs.length]);

  const { messages: rewardMsgs } = usePubSub("REWARD");
  const [broadcast, setBroadcast] = useState<BroadcastPayload | null>(null);
  useEffect(() => {
    const last = rewardMsgs[rewardMsgs.length - 1];
    if (!last) return;
    try {
      const p = JSON.parse(last.message as unknown as string) as BroadcastPayload & {
        broadcastId?: string;
      };
      setBroadcast({ ...p, id: p.broadcastId ?? crypto.randomUUID() });
    } catch {}
  }, [rewardMsgs.length]);

  // LOWER_HANDS listener
  const { publish: publishHand } = usePubSub("HAND_RAISE");
  const { messages: lowerHandMsgs } = usePubSub("LOWER_HANDS");
  useEffect(() => {
    const last = lowerHandMsgs[lowerHandMsgs.length - 1];
    if (!last || !handRaised) return;
    publishHand(
      JSON.stringify({
        uid: user?.uid,
        name: user?.displayName ?? "Student",
        state: "lowered",
        at: Date.now(),
      }),
      { persist: true },
    );
    setHandRaised(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lowerHandMsgs.length]);

  // Quiz Q for the overlay
  const { messages: qMsgs } = usePubSub("QUIZ_Q");
  const { messages: qEndMsgs } = usePubSub("QUIZ_Q_END");
  const latestQuestion = useMemo<QuizQ | null>(() => {
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
    for (const m of qEndMsgs) {
      try {
        const p = JSON.parse(m.message as unknown as string) as { id: string };
        set.add(p.id);
      } catch {
        set.add(String(m.message));
      }
    }
    return set;
  }, [qEndMsgs.length]);
  const questionOpen = !!latestQuestion && !endedIds.has(latestQuestion.id);

  // QUESTION_DISCUSS highlight
  const { messages: discussMsgs } = usePubSub("QUESTION_DISCUSS");
  const [flaggedQuestion, setFlaggedQuestion] = useState<string | null>(null);
  useEffect(() => {
    const last = discussMsgs[discussMsgs.length - 1];
    if (!last) return;
    try {
      const p = JSON.parse(last.message as unknown as string) as {
        text: string;
        authorUid?: string;
      };
      if (p.authorUid === user?.uid || p.authorUid == null) {
        setFlaggedQuestion(p.text);
        setTimeout(() => setFlaggedQuestion(null), 8_000);
      }
    } catch {}
  }, [discussMsgs.length, user?.uid]);

  // ── Publishers ──
  const { publish: publishReaction } = usePubSub("REACTION");
  const reactionMut = useMutation({
    mutationFn: (type: "ok" | "confused") =>
      api.post(`/classrooms/${classroomId}/reactions`, { meetingId, type }),
  });
  const emitReaction = (type: "ok" | "confused") => {
    publishReaction(
      JSON.stringify({
        uid: user?.uid,
        name: user?.displayName,
        type,
        at: Date.now(),
      }),
      { persist: false },
    );
    reactionMut.mutate(type);
  };

  const onConfused = () => {
    const next = !confused;
    setConfused(next);
    emitReaction("confused");
    toast.success(next ? "😕 Confusion signal sent" : "Flag removed");
  };
  const onGotIt = () => {
    const next = !gotIt;
    setGotIt(next);
    emitReaction("ok");
    toast.success(next ? "👍 Sent to teacher" : "");
  };

  // Note taker
  const [noteText, setNoteText] = useState("");
  const [noteTag, setNoteTag] = useState("all");
  const saveNoteMut = useMutation({
    mutationFn: () => {
      const tag = noteTag === "all" ? null : noteTag;
      return api.post("/student/notes", {
        meetingId,
        text: noteText,
        tags: tag ? [tag] : [],
      });
    },
    onSuccess: () => {
      toast.success("Note saved");
      setNoteText("");
    },
    onError: (err: Error) => toast.error(err.message),
  });
  const saveNote = () => {
    if (!noteText.trim() || saveNoteMut.isPending) return;
    saveNoteMut.mutate();
  };

  // Presenter / teacher participant info
  const teacherParticipantId = [...participants.keys()].find((pid) => pid === teacherId);
  const hasTeacher = !!teacherParticipantId;
  const teacherInitials = teacherName
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <main className="main">
      <div className="main-tabs">
        <div
          className={`mt${pane === "live" ? " on" : ""}`}
          onClick={() => setPane("live")}
          style={{ cursor: "pointer" }}
        >
          Live Class
        </div>
        <div
          className={`mt${pane === "gaming" ? " on" : ""}`}
          onClick={() => setPane("gaming")}
          style={{ cursor: "pointer" }}
        >
          🎮 Gaming Room
        </div>
      </div>

      {pane === "gaming" && (
        <div className="pane on">
          <GamingPane meetingId={meetingId} classroomId={classroomId} />
        </div>
      )}

      {pane === "live" && (
      <div className="pane on">
        {/* Always-on audio mixer for every non-local participant */}
        <RoomAudioMixer />

        {/* Reward confetti */}
        <RewardBroadcast payload={broadcast} onDone={() => setBroadcast(null)} />

        {/* Flagged question toast */}
        {flaggedQuestion && (
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: 72,
              transform: "translateX(-50%)",
              zIndex: 35,
              background: "#E4F4FA",
              border: "1px solid #0F7EA6",
              color: "#0F7EA6",
              borderRadius: 12,
              padding: "8px 14px",
              fontSize: 12,
              fontWeight: 600,
              boxShadow: "0 4px 18px rgba(0,0,0,.15)",
            }}
          >
            👉 Teacher is discussing: &ldquo;{flaggedQuestion}&rdquo;
          </div>
        )}

        {/* Live stage */}
        <div
          className="live-stage"
          style={fullscreen ? { height: "calc(100vh - 100px)" } : undefined}
        >
          <LaserPointer active canEdit={false}>
            {hasTeacher ? (
              <TeacherTile
                participantId={teacherParticipantId!}
                teacherName={teacherName}
              />
            ) : (
              <div className="teacher-av-wrap">
                <div className="teacher-av">{teacherInitials}</div>
                <div className="teacher-lbl">
                  {teacherName} · waiting to start
                </div>
              </div>
            )}
            <div className="screen-badge">
              <div className="screen-dot" />
              <span className="screen-lbl">Live · {classroomName}</span>
            </div>

            <div className={`q-overlay${questionOpen && latestQuestion ? " show" : ""}`}>
              <div className="q-overlay-hdr">📌 Question on screen</div>
              <div className="q-overlay-text">{latestQuestion?.text ?? ""}</div>
              {latestQuestion?.code && (
                <span className="q-overlay-code">{latestQuestion.code}</span>
              )}
            </div>
          </LaserPointer>

          {whiteboardOpen && (
            <div className="absolute inset-0" style={{ zIndex: 30, background: "rgba(0,0,0,.6)" }}>
              <Whiteboard active canEdit={false} onClose={() => setWhiteboardOpen(false)} />
            </div>
          )}
          {slideOpen && (
            <StudentSlideViewer
              meetingId={meetingId}
              onClose={() => setSlideOpen(false)}
            />
          )}
        </div>

        {/* Live controls */}
        <div className="live-ctrls">
          <button
            className={`lc-btn${handRaised ? " active" : ""}`}
            onClick={toggleHand}
          >
            ✋ {handRaised ? "Hand raised" : "Raise hand"}
          </button>
          <button
            className={`lc-btn${confused ? " danger" : ""}`}
            onClick={onConfused}
          >
            😕 Confused
          </button>
          <button
            className={`lc-btn${gotIt ? " active" : ""}`}
            onClick={onGotIt}
          >
            👍 Got it
          </button>
          <div className="lc-sep" />
          <button
            className={`lc-btn${fullscreen ? " active" : ""}`}
            onClick={() => setFullscreen((v) => !v)}
          >
            ⛶ Full screen
          </button>
          <span className="lc-status">
            {participants.size} online
          </span>
        </div>

        {/* Thin quiz-timer bar under the controls */}
        <QuizTimerBar question={latestQuestion} ended={!questionOpen} />

        {/* Note taker */}
        <div className="notetaker">
          <div className="nt-hdr">
            <span className="nt-title">📝 Note taker</span>
            <div className="nt-tags">
              {NOTE_TAGS.map((t) => (
                <button
                  key={t.id}
                  className={`nt-tag${noteTag === t.id ? " on" : ""}`}
                  onClick={() => setNoteTag(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <textarea
            className="nt-area"
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === "Enter") saveNote();
            }}
            placeholder="Type your notes here — press Ctrl+Enter or click Save to add to your notes tab…"
            rows={4}
          />
          <div className="nt-footer">
            <span className="nt-hint">Ctrl+Enter to save</span>
            <button
              className="nt-save"
              onClick={saveNote}
              disabled={!noteText.trim() || saveNoteMut.isPending}
            >
              {saveNoteMut.isPending ? "Saving…" : "Save note →"}
            </button>
          </div>
        </div>
      </div>
      )}

      <CalculatorOverlay
        open={calcOpen}
        canEdit={false}
        onClose={() => setCalcOpen(false)}
      />
    </main>
  );
}

function TeacherTile({
  participantId,
  teacherName,
}: {
  participantId: string;
  teacherName: string;
}) {
  const p = useParticipant(participantId) as unknown as {
    webcamStream?: { track: MediaStreamTrack };
    webcamOn: boolean;
    screenShareStream?: { track: MediaStreamTrack };
    screenShareAudioStream?: { track: MediaStreamTrack };
    screenShareOn: boolean;
    displayName?: string;
    isLocal: boolean;
  };
  const {
    webcamStream,
    webcamOn,
    screenShareStream,
    screenShareAudioStream,
    screenShareOn,
    displayName,
    isLocal,
  } = p;

  const webcamRef = useRef<HTMLVideoElement | null>(null);
  const screenRef = useRef<HTMLVideoElement | null>(null);
  const screenAudioRef = useRef<HTMLAudioElement | null>(null);

  const initials = (displayName ?? teacherName ?? "T")
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  // Webcam video
  useEffect(() => {
    if (!webcamRef.current) return;
    if (webcamOn && webcamStream && !screenShareOn) {
      const media = new MediaStream();
      media.addTrack(webcamStream.track);
      webcamRef.current.srcObject = media;
      webcamRef.current.play().catch(() => {});
    } else {
      webcamRef.current.srcObject = null;
    }
  }, [webcamOn, webcamStream, screenShareOn]);

  // Screen share video — takes over the stage when active
  useEffect(() => {
    if (!screenRef.current) return;
    if (screenShareOn && screenShareStream) {
      const media = new MediaStream();
      media.addTrack(screenShareStream.track);
      screenRef.current.srcObject = media;
      screenRef.current.play().catch(() => {});
    } else {
      screenRef.current.srcObject = null;
    }
  }, [screenShareOn, screenShareStream]);

  // Screen share system audio (e.g., teacher plays a video while sharing)
  useEffect(() => {
    if (!screenAudioRef.current) return;
    if (screenShareOn && screenShareAudioStream && !isLocal) {
      const ms = new MediaStream();
      ms.addTrack(screenShareAudioStream.track);
      screenAudioRef.current.srcObject = ms;
      screenAudioRef.current.play().catch(() => {});
    } else {
      screenAudioRef.current.srcObject = null;
    }
  }, [screenShareOn, screenShareAudioStream, isLocal]);

  return (
    <div className="absolute inset-0">
      {screenShareOn ? (
        <video
          ref={screenRef}
          autoPlay
          playsInline
          muted
          className="h-full w-full bg-black object-contain"
        />
      ) : webcamOn ? (
        <video
          ref={webcamRef}
          autoPlay
          playsInline
          muted
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="teacher-av-wrap">
          <div className="teacher-av">{initials}</div>
          <div className="teacher-lbl">
            {displayName ?? teacherName} · teaching now
          </div>
        </div>
      )}
      {!isLocal && <audio ref={screenAudioRef} autoPlay playsInline />}
    </div>
  );
}

/** Plays mic audio for every non-local participant the student shares the
 *  room with. Mounted once per student so e.g. peer chat / TA mics are
 *  audible. Renders nothing visible. */
function RoomAudioMixer() {
  const { participants } = useMeeting();
  const ids = [...participants.keys()];
  return (
    <>
      {ids.map((pid) => (
        <PeerAudio key={pid} participantId={pid} />
      ))}
    </>
  );
}

function PeerAudio({ participantId }: { participantId: string }) {
  const { micStream, micOn, isLocal } = useParticipant(participantId);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!audioRef.current) return;
    if (micOn && micStream && !isLocal) {
      const ms = new MediaStream();
      ms.addTrack(micStream.track);
      audioRef.current.srcObject = ms;
      audioRef.current.play().catch(() => {});
    } else {
      audioRef.current.srcObject = null;
    }
  }, [micOn, micStream, isLocal]);

  if (isLocal) return null;
  return <audio ref={audioRef} autoPlay playsInline />;
}

function QuizTimerBar({ question, ended }: { question: QuizQ | null; ended: boolean }) {
  const [pct, setPct] = useState(0);
  useEffect(() => {
    if (!question || ended) {
      setPct(0);
      return;
    }
    const DURATION = 60_000;
    const tick = () => {
      const remaining = Math.max(0, DURATION - (Date.now() - question.openedAt));
      setPct((remaining / DURATION) * 100);
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [question, ended]);

  return (
    <div className="quiz-timer-bar">
      <div className="quiz-timer-fill" style={{ width: `${pct}%` }} />
    </div>
  );
}
