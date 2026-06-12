import "server-only";
import { adminDb } from "@/server/firebase-admin";
import { Collections } from "@/shared/constants/collections";
import { resolveSubjectName } from "@/shared/constants/subjects";

export type RelevantClassroom = {
  id: string;
  name: string;
  subjectId: string;
  subjectName: string;
  grade: number;
  teacherId: string;
  studentIds?: string[];
  code?: string;
};

function normalize(s: string) {
  return s.trim().toLowerCase();
}

type ClassroomDoc = {
  name?: string;
  subjectId?: string;
  subjectName?: string;
  grade?: number;
  teacherId?: string;
  studentIds?: string[];
  code?: string;
};

/**
 * The classrooms a student should see: ones they're enrolled in OR ones whose
 * subject matches the student's declared `subjects`. Single source of truth for
 * both the live-classes dashboard feed and the class-alert reminder feed, so a
 * student is always reminded for exactly the classes shown on their dashboard.
 */
export async function relevantClassrooms(uid: string): Promise<{
  classrooms: RelevantClassroom[];
  subjectNameById: Map<string, string>;
  enrolledIds: Set<string>;
}> {
  const userDoc = await adminDb.collection(Collections.USERS).doc(uid).get();
  const subjectsSet = new Set(
    ((userDoc.data()?.subjects as string[] | undefined) ?? []).map(normalize),
  );

  const [subjSnap, classSnap] = await Promise.all([
    adminDb.collection(Collections.SUBJECTS).get(),
    adminDb.collection(Collections.CLASSROOMS).get(),
  ]);

  const subjectNameById = new Map<string, string>();
  for (const d of subjSnap.docs) {
    const n = (d.data() as { name?: string }).name;
    if (n) subjectNameById.set(d.id, n);
  }

  const matches = (c: ClassroomDoc): boolean => {
    if ((c.studentIds ?? []).includes(uid)) return true;
    if (c.subjectName && subjectsSet.has(normalize(c.subjectName))) return true;
    if (c.subjectId && subjectsSet.has(normalize(c.subjectId))) return true;
    const docName = c.subjectId ? subjectNameById.get(c.subjectId) : undefined;
    if (docName && subjectsSet.has(normalize(docName))) return true;
    return false;
  };

  const enrolledIds = new Set<string>();
  const classrooms: RelevantClassroom[] = [];
  for (const d of classSnap.docs) {
    const c = d.data() as ClassroomDoc;
    if (!matches(c)) continue;
    if ((c.studentIds ?? []).includes(uid)) enrolledIds.add(d.id);
    classrooms.push({
      id: d.id,
      name: c.name ?? "Class",
      subjectId: c.subjectId ?? "",
      subjectName: resolveSubjectName(c.subjectId ?? "", c.subjectName, subjectNameById),
      grade: c.grade ?? 0,
      teacherId: c.teacherId ?? "",
      studentIds: c.studentIds ?? [],
      code: c.code,
    });
  }

  return { classrooms, subjectNameById, enrolledIds };
}
