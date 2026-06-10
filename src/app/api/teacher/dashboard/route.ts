export const dynamic = "force-dynamic";
import "server-only";
import { NextRequest } from "next/server";
import { verifyToken } from "@/server/auth/verify-token";
import { requireRole } from "@/server/auth/require-role";
import { adminDb } from "@/server/firebase-admin";
import { Collections } from "@/shared/constants/collections";
import { scheduleService } from "@/server/services/schedule.service";
import { ok, fail } from "@/server/utils/response";

type ActivityItem = {
  id: string;
  kind: "submission" | "question" | "rejoin";
  title: string;
  subtitle: string;
  at: string;
  href?: string;
};

type DashboardResp = {
  liveNow: {
    id: string;
    classroomId: string;
    classroomName: string;
    startedAt?: string;
    participantCount: number;
  } | null;
  nextUp: {
    id: string;
    classroomId: string;
    classroomName: string;
    startedAt?: string;
  } | null;
  stats: {
    todayClasses: number;
    totalStudents: number;
    pendingGrades: number;
    openQuestions: number;
    avgScorePct: number | null;
  };
  schedule: Array<{
    date: string; // ISO date
    classes: Array<{
      id: string;
      classroomName: string;
      subjectName?: string;
      startedAt?: string;
      scheduledTime?: string;
      durationMin?: number;
      status: string;
    }>;
  }>;
  activity: ActivityItem[];
  pendingProposal: { weekStart: string; weekEnd: string; count: number } | null;
};

export async function GET(req: NextRequest) {
  try {
    const user = await verifyToken(req);
    requireRole(user, ["teacher"]);

    // Proactively ensure the AI has proposed the soonest empty week, so the
    // "review your schedule" nudge surfaces here without visiting Schedule first.
    await scheduleService.autoProposeIfNeeded(user.uid).catch((e) => {
      console.warn("[dashboard] auto-propose failed:", e);
    });

    // Teacher's classrooms
    const classroomsSnap = await adminDb
      .collection(Collections.CLASSROOMS)
      .where("teacherId", "==", user.uid)
      .get();
    const classrooms = classroomsSnap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as { name: string; studentIds?: string[]; subjectName?: string }),
    }));
    const classroomNameById = new Map(classrooms.map((c) => [c.id, c.name]));
    const classroomSubjectById = new Map(
      classrooms.map((c) => [c.id, c.subjectName ?? ""]),
    );
    const allStudents = new Set<string>();
    for (const c of classrooms) (c.studentIds ?? []).forEach((s) => allStudents.add(s));

    // Meetings
    const meetingsSnap = await adminDb
      .collection(Collections.MEETINGS)
      .where("teacherId", "==", user.uid)
      .get();
    const meetings = meetingsSnap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as {
        classroomId: string;
        status: string;
        scheduleStatus?: string;
        startedAt?: string;
        scheduledDate?: string;
        scheduledTime?: string;
        subjectName?: string;
        durationMin?: number;
        participantIds?: string[];
      }),
    }));

    // Unapproved AI proposals stay off the dashboard (and out of stats) until
    // the teacher approves them on the Schedule page.
    const visibleMeetings = meetings.filter((m) => m.scheduleStatus !== "proposed");

    const live = visibleMeetings.find((m) => m.status === "live") ?? null;
    const liveNow = live
      ? {
          id: live.id,
          classroomId: live.classroomId,
          classroomName: classroomNameById.get(live.classroomId) ?? "Class",
          startedAt: live.startedAt,
          participantCount: live.participantIds?.length ?? 0,
        }
      : null;

    const scheduled = visibleMeetings
      .filter((m) => m.status === "scheduled" && m.startedAt)
      .sort((a, b) => (a.startedAt ?? "").localeCompare(b.startedAt ?? ""));
    const next = scheduled[0];
    const nextUp = next
      ? {
          id: next.id,
          classroomId: next.classroomId,
          classroomName: classroomNameById.get(next.classroomId) ?? "Class",
          startedAt: next.startedAt,
        }
      : null;

    // Stats
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayClasses = visibleMeetings.filter(
      (m) => (m.scheduledDate ?? m.startedAt?.slice(0, 10)) === todayStr,
    ).length;

    // Assessments + submissions for pending grades + score
    const assessmentsSnap = await adminDb
      .collection(Collections.ASSESSMENTS)
      .where("teacherId", "==", user.uid)
      .get();
    const assessments = assessmentsSnap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as { classroomId: string; totalPoints?: number; status?: string }),
    }));

    let pendingGrades = 0;
    let scoreTotal = 0;
    let scoreMax = 0;
    for (const a of assessments) {
      const respSnap = await adminDb
        .collection(Collections.ASSESSMENT_SUBMISSIONS)
        .doc(a.id)
        .collection("responses")
        .get();
      for (const r of respSnap.docs) {
        const d = r.data() as { status?: string; finalScore?: number; autoScore?: number };
        if (d.status === "submitted") pendingGrades++;
        if (d.status === "graded") {
          scoreTotal += d.finalScore ?? d.autoScore ?? 0;
          scoreMax += a.totalPoints ?? 0;
        }
      }
    }
    const avgScorePct = scoreMax > 0 ? Math.round((scoreTotal / scoreMax) * 100) : null;

    // Open student questions across classrooms
    const classroomIds = classrooms.map((c) => c.id);
    let openQuestions = 0;
    const recentQuestions: ActivityItem[] = [];
    if (classroomIds.length) {
      // Firestore "in" supports up to 30 — chunk to be safe
      for (let i = 0; i < classroomIds.length; i += 10) {
        const batch = classroomIds.slice(i, i + 10);
        const qSnap = await adminDb
          .collection(Collections.CLASS_QUESTIONS)
          .where("classroomId", "in", batch)
          .get();
        for (const d of qSnap.docs) {
          const data = d.data() as {
            status?: string;
            text?: string;
            classroomId: string;
            createdAt?: string;
          };
          if (data.status === "pending") openQuestions++;
          if (data.createdAt) {
            recentQuestions.push({
              id: `q-${d.id}`,
              kind: "question",
              title:
                (data.text ?? "Question").slice(0, 90) +
                ((data.text?.length ?? 0) > 90 ? "…" : ""),
              subtitle: classroomNameById.get(data.classroomId) ?? "Class",
              at: data.createdAt,
            });
          }
        }
      }
    }

    // Recent submissions for activity
    const recentSubs: ActivityItem[] = [];
    for (const a of assessments) {
      const respSnap = await adminDb
        .collection(Collections.ASSESSMENT_SUBMISSIONS)
        .doc(a.id)
        .collection("responses")
        .get();
      for (const r of respSnap.docs) {
        const d = r.data() as { submittedAt?: string; status?: string; uid?: string };
        if (!d.submittedAt) continue;
        recentSubs.push({
          id: `s-${a.id}-${r.id}`,
          kind: "submission",
          title: `${d.status === "submitted" ? "Awaiting grade" : "Submission"}`,
          subtitle: classroomNameById.get(a.classroomId) ?? "Assessment",
          at: d.submittedAt,
          href: `/teacher/assessments/${a.id}`,
        });
      }
    }

    // Rejoin requests
    const rejoinSnap = await adminDb
      .collection(Collections.REJOIN_REQUESTS)
      .where("teacherId", "==", user.uid)
      .get();
    const recentRejoin: ActivityItem[] = rejoinSnap.docs.map((d) => {
      const data = d.data() as { createdAt?: string; studentName?: string; status?: string };
      return {
        id: `rj-${d.id}`,
        kind: "rejoin",
        title: `${data.studentName ?? "Student"} requested to rejoin`,
        subtitle: data.status === "pending" ? "Pending approval" : data.status ?? "—",
        at: data.createdAt ?? new Date(0).toISOString(),
      };
    });

    const activity = [...recentQuestions, ...recentSubs, ...recentRejoin]
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 8);

    // Build 7-day schedule strip (Mon-Sun current week)
    const today = new Date();
    const dow = (today.getDay() + 6) % 7; // Mon = 0
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - dow);
    const schedule = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      const isoDate = d.toISOString().slice(0, 10);
      const classes = visibleMeetings
        .filter(
          (m) =>
            (m.scheduledDate ?? m.startedAt?.slice(0, 10)) === isoDate,
        )
        .map((m) => ({
          id: m.id,
          classroomName: classroomNameById.get(m.classroomId) ?? "Class",
          subjectName: m.subjectName ?? classroomSubjectById.get(m.classroomId) ?? "",
          startedAt: m.startedAt,
          scheduledTime: m.scheduledTime ?? m.startedAt?.slice(11, 16),
          durationMin: m.durationMin ?? 60,
          status: m.status,
        }))
        .sort((a, b) => (a.scheduledTime ?? "").localeCompare(b.scheduledTime ?? ""));
      return { date: isoDate, classes };
    });

    const pendingProposal = await scheduleService.getPendingProposal(user.uid);

    const resp: DashboardResp = {
      liveNow,
      nextUp,
      stats: {
        todayClasses,
        totalStudents: allStudents.size,
        pendingGrades,
        openQuestions,
        avgScorePct,
      },
      schedule,
      activity,
      pendingProposal,
    };
    return ok(resp);
  } catch (e) {
    return fail(e);
  }
}
