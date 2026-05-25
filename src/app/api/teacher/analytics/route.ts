export const dynamic = "force-dynamic";
import "server-only";
import { NextRequest } from "next/server";
import { verifyToken } from "@/server/auth/verify-token";
import { requireRole } from "@/server/auth/require-role";
import { adminDb } from "@/server/firebase-admin";
import { Collections } from "@/shared/constants/collections";
import { ok, fail } from "@/server/utils/response";

type ClassAnalytics = {
  classroomId: string;
  classroomName: string;
  studentCount: number;
  meetingsHeld: number;
  avgAttendancePct: number;
  assessmentsAssigned: number;
  submissionRate: number; // % submissions across assigned * enrolled
  avgScorePct: number | null;
};

type Bucket = "0-25" | "25-50" | "50-75" | "75-100";
type ScoreDist = Record<Bucket, number>;

type AnalyticsResp = {
  perClass: ClassAnalytics[];
  totals: {
    classes: number;
    students: number;
    meetingsHeld: number;
    avgAttendancePct: number;
    avgScorePct: number | null;
  };
  scoreDistribution: ScoreDist;
  attendanceTrend: Array<{ date: string; attendedAvgPct: number; meetings: number }>; // last 14 days
};

function bucket(pct: number): Bucket {
  if (pct < 25) return "0-25";
  if (pct < 50) return "25-50";
  if (pct < 75) return "50-75";
  return "75-100";
}

export async function GET(req: NextRequest) {
  try {
    const user = await verifyToken(req);
    requireRole(user, ["teacher"]);

    const classroomsSnap = await adminDb
      .collection(Collections.CLASSROOMS)
      .where("teacherId", "==", user.uid)
      .get();
    const classrooms = classroomsSnap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as { name?: string; studentIds?: string[] }),
    }));

    const meetingsSnap = await adminDb
      .collection(Collections.MEETINGS)
      .where("teacherId", "==", user.uid)
      .get();
    const meetings = meetingsSnap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as {
        classroomId: string;
        status: string;
        startedAt?: string;
        participantIds?: string[];
      }),
    }));

    const assessmentsSnap = await adminDb
      .collection(Collections.ASSESSMENTS)
      .where("teacherId", "==", user.uid)
      .get();
    const assessments = assessmentsSnap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as { classroomId: string; status?: string; totalPoints?: number }),
    }));

    const perClass: ClassAnalytics[] = [];
    const dist: ScoreDist = { "0-25": 0, "25-50": 0, "50-75": 0, "75-100": 0 };

    let totalAttendanceSum = 0;
    let totalAttendanceN = 0;
    let totalScoreSum = 0;
    let totalScoreMax = 0;
    let totalMeetingsHeld = 0;
    let totalStudents = 0;

    for (const c of classrooms) {
      const cMeetings = meetings.filter(
        (m) => m.classroomId === c.id && m.status === "ended",
      );
      const enrolled = c.studentIds?.length ?? 0;
      totalStudents += enrolled;

      // Avg attendance: average across meetings of (attendees / enrolled)
      let attendanceSum = 0;
      let attendanceN = 0;
      for (const m of cMeetings) {
        if (!enrolled) continue;
        attendanceSum += ((m.participantIds?.length ?? 0) / enrolled) * 100;
        attendanceN++;
      }
      const avgAttendancePct =
        attendanceN > 0 ? Math.round(attendanceSum / attendanceN) : 0;

      // Assessments + scores
      const cAssessments = assessments.filter(
        (a) => a.classroomId === c.id && a.status !== "draft",
      );
      let classScoreSum = 0;
      let classScoreMax = 0;
      let submissionCount = 0;
      for (const a of cAssessments) {
        const respSnap = await adminDb
          .collection(Collections.ASSESSMENT_SUBMISSIONS)
          .doc(a.id)
          .collection("responses")
          .get();
        submissionCount += respSnap.docs.length;
        for (const r of respSnap.docs) {
          const d = r.data() as {
            status?: string;
            finalScore?: number;
            autoScore?: number;
          };
          if (d.status === "graded") {
            const s = d.finalScore ?? d.autoScore ?? 0;
            const m = a.totalPoints ?? 0;
            classScoreSum += s;
            classScoreMax += m;
            if (m > 0) dist[bucket((s / m) * 100)]++;
          }
        }
      }
      const submissionRate =
        cAssessments.length && enrolled
          ? Math.round((submissionCount / (cAssessments.length * enrolled)) * 100)
          : 0;
      const avgScorePct =
        classScoreMax > 0 ? Math.round((classScoreSum / classScoreMax) * 100) : null;

      perClass.push({
        classroomId: c.id,
        classroomName: c.name ?? "Class",
        studentCount: enrolled,
        meetingsHeld: cMeetings.length,
        avgAttendancePct,
        assessmentsAssigned: cAssessments.length,
        submissionRate,
        avgScorePct,
      });

      totalMeetingsHeld += cMeetings.length;
      totalAttendanceSum += attendanceSum;
      totalAttendanceN += attendanceN;
      totalScoreSum += classScoreSum;
      totalScoreMax += classScoreMax;
    }

    // 14-day attendance trend
    const today = new Date();
    const trend: AnalyticsResp["attendanceTrend"] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      const dayMeetings = meetings.filter(
        (m) => m.status === "ended" && m.startedAt?.slice(0, 10) === iso,
      );
      let sum = 0;
      let n = 0;
      for (const m of dayMeetings) {
        const enrolled =
          classrooms.find((c) => c.id === m.classroomId)?.studentIds?.length ?? 0;
        if (!enrolled) continue;
        sum += ((m.participantIds?.length ?? 0) / enrolled) * 100;
        n++;
      }
      trend.push({
        date: iso,
        attendedAvgPct: n > 0 ? Math.round(sum / n) : 0,
        meetings: dayMeetings.length,
      });
    }

    const resp: AnalyticsResp = {
      perClass: perClass.sort((a, b) => b.studentCount - a.studentCount),
      totals: {
        classes: classrooms.length,
        students: totalStudents,
        meetingsHeld: totalMeetingsHeld,
        avgAttendancePct:
          totalAttendanceN > 0
            ? Math.round(totalAttendanceSum / totalAttendanceN)
            : 0,
        avgScorePct:
          totalScoreMax > 0 ? Math.round((totalScoreSum / totalScoreMax) * 100) : null,
      },
      scoreDistribution: dist,
      attendanceTrend: trend,
    };
    return ok(resp);
  } catch (e) {
    return fail(e);
  }
}
