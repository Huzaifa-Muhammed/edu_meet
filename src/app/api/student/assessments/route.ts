export const dynamic = "force-dynamic";
import "server-only";
import { NextRequest } from "next/server";
import { verifyToken } from "@/server/auth/verify-token";
import { requireRole } from "@/server/auth/require-role";
import { adminDb } from "@/server/firebase-admin";
import { Collections } from "@/shared/constants/collections";
import { ok, fail } from "@/server/utils/response";

type AssessmentDoc = {
  classroomId: string;
  teacherId: string;
  title: string;
  instructions?: string;
  dueAt?: string;
  totalPoints: number;
  status: string;
  createdAt: string;
};

type ClassroomDoc = { name: string; studentIds?: string[] };

export async function GET(req: NextRequest) {
  try {
    const user = await verifyToken(req);
    requireRole(user, ["student"]);

    // Enrolled classrooms
    const classroomsSnap = await adminDb
      .collection(Collections.CLASSROOMS)
      .where("studentIds", "array-contains", user.uid)
      .get();

    const classroomMap = new Map<string, string>();
    for (const d of classroomsSnap.docs) {
      const data = d.data() as ClassroomDoc;
      classroomMap.set(d.id, data.name);
    }
    const classroomIds = [...classroomMap.keys()];

    if (!classroomIds.length) return ok([]);

    // Fetch assessments in chunks of 10 (Firestore "in" limit)
    const assessments: Array<{ id: string } & AssessmentDoc> = [];
    for (let i = 0; i < classroomIds.length; i += 10) {
      const chunk = classroomIds.slice(i, i + 10);
      const snap = await adminDb
        .collection(Collections.ASSESSMENTS)
        .where("classroomId", "in", chunk)
        .where("status", "in", ["assigned", "closed"])
        .get();
      for (const d of snap.docs) {
        assessments.push({ id: d.id, ...(d.data() as AssessmentDoc) });
      }
    }

    // Fetch this student's submissions for each
    const withStatus = await Promise.all(
      assessments.map(async (a) => {
        const subDoc = await adminDb
          .collection(Collections.ASSESSMENT_SUBMISSIONS)
          .doc(a.id)
          .collection("responses")
          .doc(user.uid)
          .get();

        const submission = subDoc.exists
          ? (subDoc.data() as {
              finalScore?: number;
              autoScore?: number;
              status: string;
              submittedAt?: string;
            })
          : null;

        return {
          id: a.id,
          title: a.title,
          instructions: a.instructions,
          dueAt: a.dueAt,
          totalPoints: a.totalPoints,
          createdAt: a.createdAt,
          classroomId: a.classroomId,
          classroomName: classroomMap.get(a.classroomId) ?? a.classroomId,
          submitted: !!submission,
          submissionStatus: submission?.status ?? null,
          finalScore: submission?.finalScore ?? submission?.autoScore ?? null,
          submittedAt: submission?.submittedAt ?? null,
        };
      }),
    );

    // Sort: not-submitted first, then by due date, then by created
    withStatus.sort((a, b) => {
      if (a.submitted !== b.submitted) return a.submitted ? 1 : -1;
      if (a.dueAt && b.dueAt) return a.dueAt.localeCompare(b.dueAt);
      return b.createdAt.localeCompare(a.createdAt);
    });

    return ok(withStatus);
  } catch (e) {
    return fail(e);
  }
}
