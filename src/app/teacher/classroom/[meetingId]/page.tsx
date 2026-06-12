"use client";

import { useState, useEffect, useMemo } from "react";
import { usePubSub } from "@videosdk.live/react-sdk";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "@/lib/api/client";
import { EdumeetMeetingProvider } from "@/providers/videosdk-provider";
import { ClassroomSidenav } from "@/components/teacher/classroom/classroom-sidenav";
import { ClassroomTopbar } from "@/components/teacher/classroom/classroom-topbar";
import { LeftPanel } from "@/components/teacher/classroom/left-panel";
import { MainArea } from "@/components/teacher/classroom/main-area";
import { CopilotPanel } from "@/components/teacher/classroom/copilot-panel";
import { ComprehensionModal } from "@/components/teacher/classroom/comprehension-modal";
import { EndSummaryModal } from "@/components/teacher/classroom/end-summary-modal";
import {
  ModerationReceiver,
  useModerationBroadcast,
} from "@/components/teacher/classroom/moderation-receiver";
import { useAuth } from "@/providers/auth-provider";
import type { Classroom } from "@/shared/types/domain";

type TokenResponse = {
  token: string;
  roomId: string;
  isMod: boolean;
  participantId: string;
  displayName: string;
};

type Meeting = {
  id: string;
  classroomId: string;
  videosdkRoomId?: string | null;
  status: string;
};

export default function ClassroomPage() {
  const params = useParams<{ meetingId: string }>();
  const meetingId = params.meetingId;
  const router = useRouter();
  const { user } = useAuth();

  const [copilotOpen, setCopilotOpen] = useState(true);
  const [whiteboardOn, setWhiteboardOn] = useState(false);
  const [pointerOn, setPointerOn] = useState(false);
  const [muteAllOn, setMuteAllOn] = useState(false);
  const [compOpen, setCompOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const [calcOpen, setCalcOpen] = useState(false);

  const meetingQ = useQuery({
    queryKey: ["meeting", meetingId],
    queryFn: () => api.get(`/meetings/${meetingId}`) as unknown as Promise<Meeting>,
    enabled: !!meetingId,
  });

  const tokenQ = useQuery({
    queryKey: ["meeting-token", meetingId],
    queryFn: () =>
      api.get(`/meetings/${meetingId}/token`) as unknown as Promise<TokenResponse>,
    enabled: !!meetingId,
    retry: false,
  });

  const classroomQ = useQuery({
    queryKey: ["classroom", meetingQ.data?.classroomId],
    queryFn: () =>
      api.get(`/classrooms/${meetingQ.data!.classroomId}`) as unknown as Promise<Classroom>,
    enabled: !!meetingQ.data?.classroomId,
  });

  const startMut = useMutation({
    mutationFn: () => api.post(`/meetings/${meetingId}/start`, {}),
  });

  useEffect(() => {
    if (meetingQ.data && meetingQ.data.status !== "live" && meetingQ.data.status !== "ended") {
      startMut.mutate();
    }
  }, [meetingQ.data]);

  const endMut = useMutation({
    mutationFn: (body: { remarks?: string; issues?: string[]; impact?: string }) =>
      api.post(`/meetings/${meetingId}/end`, body),
    onSuccess: () => {
      toast.success("Class ended");
      router.push("/teacher/classes");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (meetingQ.isLoading || tokenQ.isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-black text-white/70">
        Preparing classroom…
      </div>
    );
  }

  if (tokenQ.error || !tokenQ.data) {
    const msg = (tokenQ.error as Error | undefined)?.message ?? "Token unavailable";
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-black p-6 text-center text-white/70">
        <p className="text-sm">Cannot start video — VideoSDK token unavailable.</p>
        <p className="max-w-md text-xs text-white/40">{msg}</p>
        <p className="max-w-md text-[11px] text-white/30">
          Make sure <code>VIDEOSDK_API_KEY</code> and <code>VIDEOSDK_SECRET_KEY</code> are set
          in <code>.env.local</code> and the dev server has been restarted.
        </p>
        <button
          onClick={() => router.push("/teacher/classes")}
          className="mt-3 rounded-lg border border-white/20 px-4 py-1.5 text-xs hover:bg-white/10"
        >
          Back to classes
        </button>
      </div>
    );
  }

  const { token, roomId, isMod, participantId, displayName } = tokenQ.data;
  const classroomName = classroomQ.data?.name ?? "Class in session";
  const classroomSubject = (classroomQ.data as { subjectName?: string } | undefined)?.subjectName;
  const initial =
    (user?.displayName ?? displayName ?? "T").trim().slice(0, 1).toUpperCase();

  const onEnd = () => setEndOpen(true);

  return (
    <EdumeetMeetingProvider
      token={token}
      roomId={roomId}
      displayName={displayName}
      participantId={participantId}
      isMod={isMod}
    >
      <ClassroomShell
        classroomName={classroomName}
        classroomSubject={classroomSubject}
        classroomId={meetingQ.data!.classroomId}
        meetingId={meetingId}
        initial={initial}
        isMod={isMod}
        copilotOpen={copilotOpen}
        setCopilotOpen={setCopilotOpen}
        whiteboardOn={whiteboardOn}
        setWhiteboardOn={setWhiteboardOn}
        pointerOn={pointerOn}
        setPointerOn={setPointerOn}
        muteAllOn={muteAllOn}
        setMuteAllOn={setMuteAllOn}
        compOpen={compOpen}
        setCompOpen={setCompOpen}
        endOpen={endOpen}
        setEndOpen={setEndOpen}
        calcOpen={calcOpen}
        setCalcOpen={setCalcOpen}
        onEnd={onEnd}
        onConfirmEnd={(body) => {
          setEndOpen(false);
          endMut.mutate(body);
        }}
      />
    </EdumeetMeetingProvider>
  );
}

/** Inner shell that runs inside the MeetingProvider so pubsub hooks are usable. */
function ClassroomShell({
  classroomName,
  classroomSubject,
  classroomId,
  meetingId,
  initial,
  isMod,
  copilotOpen,
  setCopilotOpen,
  whiteboardOn,
  setWhiteboardOn,
  pointerOn,
  setPointerOn,
  muteAllOn,
  setMuteAllOn,
  compOpen,
  setCompOpen,
  endOpen,
  setEndOpen,
  calcOpen,
  setCalcOpen,
  onEnd,
  onConfirmEnd,
}: {
  classroomName: string;
  classroomSubject?: string;
  classroomId: string;
  meetingId: string;
  initial: string;
  isMod: boolean;
  copilotOpen: boolean;
  setCopilotOpen: React.Dispatch<React.SetStateAction<boolean>>;
  whiteboardOn: boolean;
  setWhiteboardOn: React.Dispatch<React.SetStateAction<boolean>>;
  pointerOn: boolean;
  setPointerOn: React.Dispatch<React.SetStateAction<boolean>>;
  muteAllOn: boolean;
  setMuteAllOn: React.Dispatch<React.SetStateAction<boolean>>;
  compOpen: boolean;
  setCompOpen: React.Dispatch<React.SetStateAction<boolean>>;
  endOpen: boolean;
  setEndOpen: React.Dispatch<React.SetStateAction<boolean>>;
  calcOpen: boolean;
  setCalcOpen: React.Dispatch<React.SetStateAction<boolean>>;
  onEnd: () => void;
  onConfirmEnd: (body: { remarks?: string; issues?: string[]; impact?: string }) => void;
}) {
  const { muteAll, camOffAll } = useModerationBroadcast();

  // Live in-room signals for the end-of-class wrap-up. Reactions/hands flow
  // over pubsub and aren't persisted server-side, so we aggregate them here
  // (inside the meeting provider) and hand them to the summary modal.
  const { messages: reactionMsgs } = usePubSub("REACTION");
  const { messages: handMsgs } = usePubSub("HAND_RAISE");

  const liveSignals = useMemo(() => {
    const engaged = new Set<string>();
    for (const m of handMsgs) {
      try {
        const p = JSON.parse(m.message as unknown as string) as { uid?: string };
        if (p.uid) engaged.add(p.uid);
      } catch {
        // skip malformed
      }
    }
    // Latest reaction per student decides their comprehension signal.
    const latest = new Map<
      string,
      { type: "ok" | "confused"; state?: string; at: number }
    >();
    for (const m of reactionMsgs) {
      try {
        const p = JSON.parse(m.message as unknown as string) as {
          uid?: string;
          type?: "ok" | "confused";
          state?: "active" | "cleared";
          at?: number;
        };
        if (!p.uid || !p.type) continue;
        engaged.add(p.uid);
        const prev = latest.get(p.uid);
        const at = p.at ?? 0;
        if (!prev || at >= prev.at) latest.set(p.uid, { type: p.type, state: p.state, at });
      } catch {
        // skip malformed
      }
    }
    let understood = 0;
    let confused = 0;
    for (const r of latest.values()) {
      if (r.state === "cleared") continue;
      if (r.type === "ok") understood += 1;
      else if (r.type === "confused") confused += 1;
    }
    return {
      engagedStudents: engaged.size,
      comprehension:
        understood + confused > 0 ? { understood, confused } : null,
    };
  }, [reactionMsgs, handMsgs]);

  const doMuteAll = () => {
    muteAll();
    setMuteAllOn(true);
    toast.success("Muted all students");
    setTimeout(() => setMuteAllOn(false), 1400);
  };
  const doCamOff = () => {
    camOffAll();
    toast.success("Cameras turned off for all students");
  };

  return (
    <div className="classroom-ui flex h-screen flex-col overflow-hidden bg-bg">
      <ModerationReceiver isMod={isMod} />
      <ClassroomTopbar
        title={classroomName}
        copilotOpen={copilotOpen}
        onToggleCopilot={() => setCopilotOpen((v) => !v)}
        onEnd={onEnd}
        userInitial={initial}
      />
      <div className="flex flex-1 overflow-hidden">
        <ClassroomSidenav
          tools={{ whiteboardOn, pointerOn, muteAllOn }}
          onToggleWhiteboard={() => setWhiteboardOn((v) => !v)}
          onTogglePointer={() => setPointerOn((v) => !v)}
          onToggleMuteAll={doMuteAll}
        />
        <LeftPanel
          classroomId={classroomId}
          onShowComprehension={() => setCompOpen(true)}
          onOpenCalculator={() => setCalcOpen(true)}
        />
        <MainArea
          classroomId={classroomId}
          classroomName={classroomName}
          classroomSubject={classroomSubject}
          meetingId={meetingId}
          isMod={isMod}
          whiteboardOn={whiteboardOn}
          setWhiteboardOn={setWhiteboardOn}
          pointerOn={pointerOn}
          calcOpen={calcOpen}
          setCalcOpen={setCalcOpen}
          onMuteAll={doMuteAll}
          onCamOff={doCamOff}
          onEnd={onEnd}
        />
        {copilotOpen && (
          <CopilotPanel
            classroomName={classroomName}
            classroomId={classroomId}
            subject={classroomSubject}
            onClose={() => setCopilotOpen(false)}
          />
        )}
      </div>
      <ComprehensionModal open={compOpen} onClose={() => setCompOpen(false)} />
      <EndSummaryModal
        open={endOpen}
        onClose={() => setEndOpen(false)}
        onConfirm={onConfirmEnd}
        meetingId={meetingId}
        engagedStudents={liveSignals.engagedStudents}
        comprehension={liveSignals.comprehension}
        transcriptMeta={{
          classroomName,
          subjectName: classroomSubject,
          date: new Date().toISOString(),
        }}
      />
    </div>
  );
}
