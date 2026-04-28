"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { usePubSub } from "@videosdk.live/react-sdk";
import api from "@/lib/api/client";
import { EdumeetMeetingProvider } from "@/providers/videosdk-provider";
import { ModerationReceiver } from "@/components/teacher/classroom/moderation-receiver";
import { StudentClassroomTopbar } from "@/components/student/classroom/student-classroom-topbar";
import { StudentLeftPanel } from "@/components/student/classroom/student-left-panel";
import { StudentRightPanel } from "@/components/student/classroom/student-right-panel";
import { StudentMainArea } from "@/components/student/classroom/student-main-area";
import { useAuth } from "@/providers/auth-provider";

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
  status: string;
  startedAt?: string;
  teacherId: string;
};

type Classroom = { id: string; name: string; subjectName?: string; subjectId?: string };
type TeacherProfile = { displayName?: string };

export default function StudentClassroomPage() {
  const params = useParams<{ meetingId: string }>();
  const meetingId = params.meetingId;
  const router = useRouter();
  const { user } = useAuth();

  const meetingQ = useQuery<Meeting>({
    queryKey: ["meeting", meetingId],
    queryFn: () => api.get(`/meetings/${meetingId}`) as unknown as Promise<Meeting>,
    enabled: !!meetingId,
  });

  const tokenQ = useQuery<TokenResponse>({
    queryKey: ["meeting-token", meetingId],
    queryFn: () =>
      api.get(`/meetings/${meetingId}/token`) as unknown as Promise<TokenResponse>,
    enabled: !!meetingId,
    retry: false,
  });

  const classroomQ = useQuery<Classroom>({
    queryKey: ["classroom", meetingQ.data?.classroomId],
    queryFn: () =>
      api.get(`/classrooms/${meetingQ.data!.classroomId}`) as unknown as Promise<Classroom>,
    enabled: !!meetingQ.data?.classroomId,
  });

  const teacherQ = useQuery<TeacherProfile>({
    queryKey: ["teacher-profile", meetingQ.data?.teacherId],
    queryFn: () =>
      api.get(`/users/${meetingQ.data!.teacherId}/profile`) as unknown as Promise<TeacherProfile>,
    enabled: !!meetingQ.data?.teacherId,
  });

  // log attendance join on mount (once)
  useEffect(() => {
    if (!meetingId || !user) return;
    api.post(`/meetings/${meetingId}/attendance/event`, { type: "join" }).catch(() => {});
    const onLeave = () => {
      try {
        navigator.sendBeacon?.(
          `/api/meetings/${meetingId}/attendance/event`,
          new Blob([JSON.stringify({ type: "leave" })], { type: "application/json" }),
        );
      } catch {}
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [meetingId, user]);

  if (meetingQ.isLoading || tokenQ.isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-black text-white/70">
        Joining class…
      </div>
    );
  }

  if (tokenQ.error || !tokenQ.data) {
    const msg = (tokenQ.error as Error | undefined)?.message ?? "Token unavailable";
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-black p-6 text-center text-white/70">
        <p className="text-sm">Cannot join — video connection unavailable.</p>
        <p className="max-w-md text-xs text-white/40">{msg}</p>
        <button
          onClick={() => router.push("/student/dashboard")}
          className="mt-3 rounded-lg border border-white/20 px-4 py-1.5 text-xs hover:bg-white/10"
        >
          Back to dashboard
        </button>
      </div>
    );
  }

  if (meetingQ.data?.status === "ended") {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-black p-6 text-center text-white/70">
        <p className="text-sm">This class has ended.</p>
        <button
          onClick={() => router.push("/student/dashboard")}
          className="rounded-lg bg-white/10 px-4 py-1.5 text-xs text-white hover:bg-white/20"
        >
          Back to dashboard
        </button>
      </div>
    );
  }

  const { token, roomId, participantId, displayName } = tokenQ.data;
  const classroomName = classroomQ.data?.name ?? "Class in session";
  const subjectName = classroomQ.data?.subjectName ?? classroomQ.data?.subjectId;
  const teacherName = teacherQ.data?.displayName ?? "Teacher";
  const initial = (user?.displayName ?? displayName ?? "S").trim().slice(0, 1).toUpperCase();

  const onLeave = () => {
    toast.info("Leaving class…");
    router.push("/student/dashboard");
  };

  return (
    <EdumeetMeetingProvider
      token={token}
      roomId={roomId}
      displayName={displayName}
      participantId={participantId}
      isMod={false}
    >
      <ClassroomShell
        classroomId={meetingQ.data!.classroomId}
        meetingId={meetingId}
        classroomName={classroomName}
        subjectName={subjectName}
        teacherName={teacherName}
        teacherId={meetingQ.data!.teacherId}
        startedAt={meetingQ.data?.startedAt}
        initial={initial}
        onLeave={onLeave}
      />
    </EdumeetMeetingProvider>
  );
}

type ClassroomTheme = "glass" | "barca" | "superman";
const THEME_STORAGE_KEY = "scct";
const THEMES: ClassroomTheme[] = ["glass", "barca", "superman"];

function ClassroomShell({
  classroomId,
  meetingId,
  classroomName,
  subjectName,
  teacherName,
  teacherId,
  startedAt,
  initial,
  onLeave,
}: {
  classroomId: string;
  meetingId: string;
  classroomName: string;
  subjectName?: string;
  teacherName: string;
  teacherId: string;
  startedAt?: string;
  initial: string;
  onLeave: () => void;
}) {
  const [handRaised, setHandRaised] = useState(false);
  const [theme, setTheme] = useState<ClassroomTheme>("glass");
  const { user } = useAuth();
  const { publish: publishHand } = usePubSub("HAND_RAISE");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY) as ClassroomTheme | null;
      if (saved && THEMES.includes(saved)) setTheme(saved);
    } catch {}
  }, []);

  const changeTheme = (next: ClassroomTheme) => {
    setTheme(next);
    try { localStorage.setItem(THEME_STORAGE_KEY, next); } catch {}
  };

  const toggleHand = () => {
    const next = !handRaised;
    publishHand(
      JSON.stringify({
        uid: user?.uid,
        name: user?.displayName ?? "Student",
        state: next ? "raised" : "lowered",
        at: Date.now(),
      }),
      { persist: true },
    );
    setHandRaised(next);
  };

  return (
    <div
      className="student-classroom-ui flex h-screen flex-col overflow-hidden"
      data-theme={theme}
    >
      <div className="classroom-mesh" aria-hidden />
      <ModerationReceiver isMod={false} />
      <KickReceiver myUid={user?.uid} onKicked={onLeave} />
      <StudentClassroomTopbar
        classroomName={classroomName}
        subjectName={subjectName}
        teacherName={teacherName}
        startedAt={startedAt}
        handRaised={handRaised}
        onRaiseHand={toggleHand}
        onLeave={onLeave}
        userInitial={initial}
        theme={theme}
        onChangeTheme={changeTheme}
      />
      <div className="flex flex-1 overflow-hidden">
        <StudentLeftPanel
          classroomId={classroomId}
          meetingId={meetingId}
          subjectName={subjectName}
        />
        <StudentMainArea
          classroomId={classroomId}
          meetingId={meetingId}
          teacherId={teacherId}
          teacherName={teacherName}
          classroomName={classroomName}
          handRaised={handRaised}
          setHandRaised={setHandRaised}
          toggleHand={toggleHand}
        />
        <StudentRightPanel
          classroomId={classroomId}
          meetingId={meetingId}
          teacherId={teacherId}
        />
      </div>
    </div>
  );
}

/** Listens for STUDENT_KICK pubsub and routes to the dashboard if the
 *  current student's uid is the target. The teacher also flags the meeting
 *  with bannedUids so a refresh-and-rejoin attempt is rejected at the
 *  token endpoint — this listener is just the instant-kick UX. */
function KickReceiver({
  myUid,
  onKicked,
}: {
  myUid?: string;
  onKicked: () => void;
}) {
  const { messages } = usePubSub("STUDENT_KICK");
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (!last || !myUid) return;
    try {
      const p = JSON.parse(last.message as unknown as string) as {
        uid?: string;
      };
      if (p.uid === myUid) {
        toast.error("You were removed from the class by the teacher.");
        setTimeout(onKicked, 600);
      }
    } catch {
      // skip malformed
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, myUid]);
  return null;
}
