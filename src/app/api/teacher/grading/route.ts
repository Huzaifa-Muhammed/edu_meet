export const dynamic = "force-dynamic";
import "server-only";
import { NextRequest } from "next/server";
import { verifyToken } from "@/server/auth/verify-token";
import { requireRole } from "@/server/auth/require-role";
import { adminDb } from "@/server/firebase-admin";
import { Collections } from "@/shared/constants/collections";
import { ok, fail } from "@/server/utils/response";

type PendingItem = {
  assessmentId: string;
  assessmentTitle: string;
  classroomId: string;
  classroomName: string;
  uid: string;
  studentName?: string;
  studentEmail?: string;
  submittedAt: string;
  autoScore: number;
  totalPoints: number;
};

export async function GET(req: NextRequest) {
  try {
    const user = await verifyToken(req);
    requireRole(user, ["teacher"]);

    const assessmentsSnap = await adminDb
      .collection(Collections.ASSESSMENTS)
      .where("teacherId", "==", user.uid)
      .get();
    const assessments = assessmentsSnap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as { title?: string; classroomId: string; totalPoints?: number }),
    }));

    // Resolve classroom names
    const classroomIds = [...new Set(assessments.map((a) => a.classroomId))];
    const classroomNameById = new Map<string, string>();
    for (let i = 0; i < classroomIds.length; i += 10) {
      const batch = classroomIds.slice(i, i + 10);
      if (!batch.length) continue;
      const snap = await adminDb
        .collection(Collections.CLASSROOMS)
        .where("__name__", "in", batch)
        .get();
      for (const d of snap.docs) {
        classroomNameById.set(d.id, (d.data() as { name?: string }).name ?? "Class");
      }
    }

    const pending: PendingItem[] = [];
    const studentIdsNeeded = new Set<string>();

    for (const a of assessments) {
      const respSnap = await adminDb
        .collection(Collections.ASSESSMENT_SUBMISSIONS)
        .doc(a.id)
        .collection("responses")
        .get();
      for (const r of respSnap.docs) {
        const d = r.data() as { status?: string; submittedAt?: string; autoScore?: number };
        if (d.status === "submitted") {
          studentIdsNeeded.add(r.id);
          pending.push({
            assessmentId: a.id,
            assessmentTitle: a.title ?? "Assessment",
            classroomId: a.classroomId,
            classroomName: classroomNameById.get(a.classroomId) ?? "Class",
            uid: r.id,
            submittedAt: d.submittedAt ?? "",
            autoScore: d.autoScore ?? 0,
            totalPoints: a.totalPoints ?? 0,
          });
        }
      }
    }

    // Hydrate student profiles
    const studentIds = [...studentIdsNeeded];
    const profileMap = new Map<string, { displayName?: string; email?: string }>();
    for (let i = 0; i < studentIds.length; i += 10) {
      const batch = studentIds.slice(i, i + 10);
      if (!batch.length) continue;
      const snap = await adminDb
        .collection(Collections.USERS)
        .where("__name__", "in", batch)
        .get();
      for (const d of snap.docs) {
        const data = d.data();
        profileMap.set(d.id, { displayName: data.displayName, email: data.email });
      }
    }
    for (const p of pending) {
      const prof = profileMap.get(p.uid);
      p.studentName = prof?.displayName;
      p.studentEmail = prof?.email;
    }

    pending.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
    return ok(pending);
  } catch (e) {
    return fail(e);
  }
}
