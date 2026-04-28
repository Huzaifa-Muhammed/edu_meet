import "server-only";
import { adminDb } from "@/server/firebase-admin";
import { Collections } from "@/shared/constants/collections";
import { notFound, badRequest } from "@/server/utils/errors";
import { resolveSubjectName } from "@/shared/constants/subjects";
import type { ClassroomCreateInput, ClassroomUpdateInput } from "@/shared/schemas/classroom.schema";

function generateCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

type ClassroomDoc = {
  id: string;
  subjectId?: string;
  subjectName?: string;
  [k: string]: unknown;
};

async function loadSubjectNameMap(): Promise<Map<string, string>> {
  const snap = await adminDb.collection(Collections.SUBJECTS).get();
  const m = new Map<string, string>();
  for (const d of snap.docs) {
    const n = (d.data() as { name?: string }).name;
    if (n) m.set(d.id, n);
  }
  return m;
}

/** Walk a list of classroom docs and write back any rows whose stored
 *  subjectName is missing or matches the raw subjectId. Returns the same
 *  list with the resolved name attached so callers can use it directly. */
async function repairSubjectNames<T extends ClassroomDoc>(
  docs: T[],
  subjectNameById: Map<string, string>,
): Promise<T[]> {
  const writes: Promise<unknown>[] = [];
  for (const c of docs) {
    if (!c.subjectId) continue;
    const proper = resolveSubjectName(c.subjectId, c.subjectName, subjectNameById);
    if (proper && proper !== c.subjectName) {
      c.subjectName = proper;
      writes.push(
        adminDb
          .collection(Collections.CLASSROOMS)
          .doc(c.id)
          .update({ subjectName: proper })
          .catch(() => undefined),
      );
    }
  }
  if (writes.length) await Promise.all(writes);
  return docs;
}

export const classroomsService = {
  async create(teacherId: string, data: ClassroomCreateInput) {
    const subjectNameById = await loadSubjectNameMap();
    const subjectName = resolveSubjectName(
      data.subjectId,
      data.subjectName,
      subjectNameById,
    );

    const classroomData = {
      ...data,
      subjectName,
      teacherId,
      code: generateCode(),
      studentIds: [],
      createdAt: new Date().toISOString(),
    };
    const ref = await adminDb
      .collection(Collections.CLASSROOMS)
      .add(classroomData);
    return { id: ref.id, ...classroomData };
  },

  async getById(id: string) {
    const doc = await adminDb.collection(Collections.CLASSROOMS).doc(id).get();
    if (!doc.exists) throw notFound("Classroom");
    const c = { id: doc.id, ...doc.data() } as ClassroomDoc;
    if (c.subjectId) {
      const proper = resolveSubjectName(c.subjectId, c.subjectName);
      if (proper && proper !== c.subjectName) {
        c.subjectName = proper;
        adminDb
          .collection(Collections.CLASSROOMS)
          .doc(id)
          .update({ subjectName: proper })
          .catch(() => undefined);
      }
    }
    return c;
  },

  async list(role: string, uid: string) {
    let query;
    if (role === "teacher") {
      query = adminDb
        .collection(Collections.CLASSROOMS)
        .where("teacherId", "==", uid);
    } else if (role === "student") {
      query = adminDb
        .collection(Collections.CLASSROOMS)
        .where("studentIds", "array-contains", uid);
    } else {
      // admin sees all
      query = adminDb.collection(Collections.CLASSROOMS);
    }

    const snap = await query.get();
    const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as ClassroomDoc[];

    // Opportunistic repair: only the data owner (teacher / admin) writes
    // back. Students get the resolved label in-memory but don't trigger a
    // write — keeps student reads cheap and avoids permission surprises.
    if (role === "teacher" || role === "admin") {
      const subjectNameById = await loadSubjectNameMap();
      await repairSubjectNames(docs, subjectNameById);
    } else {
      const subjectNameById = await loadSubjectNameMap();
      for (const c of docs) {
        if (c.subjectId) {
          c.subjectName = resolveSubjectName(c.subjectId, c.subjectName, subjectNameById);
        }
      }
    }

    return docs;
  },

  async update(id: string, data: ClassroomUpdateInput) {
    const patch: Record<string, unknown> = { ...data };
    if (data.subjectId || data.subjectName) {
      const cur = await adminDb.collection(Collections.CLASSROOMS).doc(id).get();
      const stored = (cur.data() ?? {}) as ClassroomDoc;
      const subjectId = data.subjectId ?? stored.subjectId ?? "";
      patch.subjectName = resolveSubjectName(
        subjectId,
        data.subjectName ?? stored.subjectName,
      );
    }
    await adminDb.collection(Collections.CLASSROOMS).doc(id).update(patch);
    return { id, ...patch };
  },

  async enroll(classroomId: string, studentUid: string, code: string) {
    const doc = await adminDb
      .collection(Collections.CLASSROOMS)
      .doc(classroomId)
      .get();
    if (!doc.exists) throw notFound("Classroom");

    const data = doc.data()!;
    if (data.code !== code) throw badRequest("Invalid class code");

    if (data.studentIds?.includes(studentUid)) {
      return { id: classroomId, alreadyEnrolled: true };
    }

    const { FieldValue } = await import("firebase-admin/firestore");
    await adminDb
      .collection(Collections.CLASSROOMS)
      .doc(classroomId)
      .update({
        studentIds: FieldValue.arrayUnion(studentUid),
      });

    return { id: classroomId, enrolled: true };
  },
};
