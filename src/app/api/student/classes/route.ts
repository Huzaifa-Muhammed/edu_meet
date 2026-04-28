export const dynamic = "force-dynamic";
import "server-only";
import { NextRequest } from "next/server";
import { verifyToken } from "@/server/auth/verify-token";
import { requireRole } from "@/server/auth/require-role";
import { adminDb } from "@/server/firebase-admin";
import { Collections } from "@/shared/constants/collections";
import { resolveSubjectName } from "@/shared/constants/subjects";
import { ok, fail } from "@/server/utils/response";

type Classroom = {
  id: string;
  name: string;
  subjectId: string;
  subjectName?: string;
  grade: number;
  teacherId: string;
  studentIds?: string[];
  code?: string;
};

function normalize(s: string) {
  return s.trim().toLowerCase();
}

export async function GET(req: NextRequest) {
  try {
    const user = await verifyToken(req);
    requireRole(user, ["student"]);

    const userDoc = await adminDb.collection(Collections.USERS).doc(user.uid).get();
    const subjects = ((userDoc.data()?.subjects as string[] | undefined) ?? []).map(
      normalize,
    );
    const subjectsSet = new Set(subjects);

    // Build a name→id map from the subjects collection (if populated)
    const subjSnap = await adminDb.collection(Collections.SUBJECTS).get();
    const subjectNameById = new Map<string, string>();
    const subjectIdByNormalizedName = new Map<string, string>();
    for (const d of subjSnap.docs) {
      const data = d.data() as { name?: string };
      if (!data.name) continue;
      subjectNameById.set(d.id, data.name);
      subjectIdByNormalizedName.set(normalize(data.name), d.id);
    }

    const labelFor = (c: { subjectId: string; subjectName?: string }) =>
      resolveSubjectName(c.subjectId, c.subjectName, subjectNameById);

    /**
     * Case-insensitive, 3-way subject match:
     *  1) classroom.subjectName matches any student subject, OR
     *  2) classroom.subjectId matches any student subject literally, OR
     *  3) the subject doc referenced by subjectId has a name that matches.
     */
    const matchesStudent = (c: Classroom) => {
      if (c.subjectName && subjectsSet.has(normalize(c.subjectName))) return true;
      if (subjectsSet.has(normalize(c.subjectId))) return true;
      const docName = subjectNameById.get(c.subjectId);
      if (docName && subjectsSet.has(normalize(docName))) return true;
      return false;
    };

    // 1) Enrolled classrooms for this student
    const enrolledSnap = await adminDb
      .collection(Collections.CLASSROOMS)
      .where("studentIds", "array-contains", user.uid)
      .get();
    const enrolled: Classroom[] = enrolledSnap.docs.map(
      (d) => ({ id: d.id, ...(d.data() as Omit<Classroom, "id">) }),
    );

    // 2) Recommended: scan all classrooms and filter in-memory (robust match).
    // For a classroom-heavy deployment, swap this for a denormalized "subjectNormalized" field.
    const allSnap = await adminDb.collection(Collections.CLASSROOMS).get();
    const enrolledIds = new Set(enrolled.map((e) => e.id));
    const recommended: Classroom[] = [];
    for (const d of allSnap.docs) {
      const c = { id: d.id, ...(d.data() as Omit<Classroom, "id">) };
      if (enrolledIds.has(c.id)) continue;
      if (!matchesStudent(c)) continue;
      recommended.push(c);
    }

    const attach = (c: Classroom) => ({
      ...c,
      subjectName: labelFor(c),
    });

    return ok({
      subjects,
      enrolled: enrolled.map(attach),
      recommended: recommended.map(attach),
    });
  } catch (e) {
    return fail(e);
  }
}
