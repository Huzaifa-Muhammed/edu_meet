export const dynamic = "force-dynamic";
import "server-only";
import { NextRequest } from "next/server";
import { verifyToken } from "@/server/auth/verify-token";
import { requireRole } from "@/server/auth/require-role";
import { adminDb } from "@/server/firebase-admin";
import { Collections } from "@/shared/constants/collections";
import { ok, fail } from "@/server/utils/response";

type StudentReport = {
  uid: string;
  displayName?: string;
  photoUrl?: string;
  email?: string;
  classroomIds: string[];
  classroomNames: string[];
  attendedMeetings: number;
  totalMeetings: number;
  participationPct: number;
  completedAssessments: number;
  totalAssessments: number;
  avgScorePct: number | null;
};

export async function GET(req: NextRequest) {
  try {
    const user = await verifyToken(req);
    requireRole(user, ["teacher"]);

    // Teacher's classrooms
    const classroomsSnap = await adminDb
      .collection(Collections.CLASSROOMS)
      .where("teacherId", "==", user.uid)
      .get();

    const classrooms = classroomsSnap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as { name: string; studentIds?: string[] }),
    }));

    // Collect unique students
    const studentMap = new Map<
      string,
      { classroomIds: string[]; classroomNames: string[] }
    >();
    for (const c of classrooms) {
      for (const sid of c.studentIds ?? []) {
        const entry = studentMap.get(sid) ?? { classroomIds: [], classroomNames: [] };
        entry.classroomIds.push(c.id);
        entry.classroomNames.push(c.name);
        studentMap.set(sid, entry);
      }
    }

    const studentIds = [...studentMap.keys()];
    if (!studentIds.length) return ok([]);

    // Teacher's meetings
    const meetingsSnap = await adminDb
      .collection(Collections.MEETINGS)
      .where("teacherId", "==", user.uid)
      .get();
    const meetings = meetingsSnap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as { classroomId: string; status: string; participantIds?: string[] }),
    }));

    // Teacher's assessments
    const assessmentsSnap = await adminDb
      .collection(Collections.ASSESSMENTS)
      .where("teacherId", "==", user.uid)
      .get();
    const assessments = assessmentsSnap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as { classroomId: string; totalPoints: number; status: string }),
    }));

    // Fetch student profiles
    const profileMap = new Map<string, { displayName?: string; email?: string; photoUrl?: string }>();
    for (let i = 0; i < studentIds.length; i += 10) {
      const batch = studentIds.slice(i, i + 10);
      const snap = await adminDb
        .collection(Collections.USERS)
        .where("__name__", "in", batch)
        .get();
      for (const d of snap.docs) {
        const data = d.data();
        profileMap.set(d.id, {
          displayName: data.displayName,
          email: data.email,
          photoUrl: data.photoUrl,
        });
      }
    }

    const reports: StudentReport[] = [];

    for (const sid of studentIds) {
      const enrollment = studentMap.get(sid)!;
      const myClassroomIds = new Set(enrollment.classroomIds);

      const relevantMeetings = meetings.filter(
        (m) => myClassroomIds.has(m.classroomId) && m.status === "ended",
      );
      const attended = relevantMeetings.filter(
        (m) => (m.participantIds ?? []).includes(sid),
      ).length;

      const relevantAssessments = assessments.filter(
        (a) => myClassroomIds.has(a.classroomId) && a.status !== "draft",
      );

      let completed = 0;
      let scoreTotal = 0;
      let scoreMax = 0;

      for (const a of relevantAssessments) {
        const subDoc = await adminDb
          .collection(Collections.ASSESSMENT_SUBMISSIONS)
          .doc(a.id)
          .collection("responses")
          .doc(sid)
          .get();
        if (subDoc.exists) {
          completed++;
          const data = subDoc.data() as { finalScore?: number; autoScore?: number };
          const s = data.finalScore ?? data.autoScore ?? 0;
          scoreTotal += s;
          scoreMax += a.totalPoints ?? 0;
        }
      }

      const profile = profileMap.get(sid) ?? {};

      reports.push({
        uid: sid,
        displayName: profile.displayName,
        email: profile.email,
        photoUrl: profile.photoUrl,
        classroomIds: enrollment.classroomIds,
        classroomNames: enrollment.classroomNames,
        attendedMeetings: attended,
        totalMeetings: relevantMeetings.length,
        participationPct:
          relevantMeetings.length > 0
            ? Math.round((attended / relevantMeetings.length) * 100)
            : 0,
        completedAssessments: completed,
        totalAssessments: relevantAssessments.length,
        avgScorePct: scoreMax > 0 ? Math.round((scoreTotal / scoreMax) * 100) : null,
      });
    }

    reports.sort((a, b) => (b.avgScorePct ?? -1) - (a.avgScorePct ?? -1));
    return ok(reports);
  } catch (e) {
    return fail(e);
  }
}
