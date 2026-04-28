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
};

type Meeting = {
  id: string;
  classroomId: string;
  status: string;
  startedAt?: string;
  teacherId: string;
  videosdkRoomId?: string | null;
};

type Teacher = { displayName?: string; email?: string; photoUrl?: string };

function normalize(s: string) {
  return s.trim().toLowerCase();
}

/**
 * Returns live + upcoming meetings tied to classrooms the student is
 * enrolled in OR classrooms matching the student's subjects. Enriched
 * with classroom name + teacher display info so the dashboard can
 * render join cards without extra round-trips.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await verifyToken(req);
    requireRole(user, ["student"]);

    const userDoc = await adminDb.collection(Collections.USERS).doc(user.uid).get();
    const subjects = ((userDoc.data()?.subjects as string[] | undefined) ?? []).map(
      normalize,
    );
    const subjectsSet = new Set(subjects);

    const subjSnap = await adminDb.collection(Collections.SUBJECTS).get();
    const subjectNameById = new Map<string, string>();
    for (const d of subjSnap.docs) {
      const n = (d.data() as { name?: string }).name;
      if (n) subjectNameById.set(d.id, n);
    }

    const allClassSnap = await adminDb.collection(Collections.CLASSROOMS).get();
    const classrooms: Classroom[] = allClassSnap.docs.map(
      (d) => ({ id: d.id, ...(d.data() as Omit<Classroom, "id">) }),
    );

    const matches = (c: Classroom) => {
      if ((c.studentIds ?? []).includes(user.uid)) return true;
      if (c.subjectName && subjectsSet.has(normalize(c.subjectName))) return true;
      if (subjectsSet.has(normalize(c.subjectId))) return true;
      const docName = subjectNameById.get(c.subjectId);
      if (docName && subjectsSet.has(normalize(docName))) return true;
      return false;
    };

    const relevant = classrooms
      .filter(matches)
      .map((c) => ({
        ...c,
        subjectName: resolveSubjectName(c.subjectId, c.subjectName, subjectNameById),
      }));
    const relevantIds = new Set(relevant.map((c) => c.id));
    if (relevantIds.size === 0) return ok({ live: [], upcoming: [] });

    // Meetings that are live OR scheduled. Firestore "in" maxes out at 10 ids,
    // so we do an in-memory filter.
    const meetingsSnap = await adminDb
      .collection(Collections.MEETINGS)
      .where("status", "in", ["scheduled", "live"])
      .get();

    const teacherIds = new Set<string>();
    const live: (Meeting & {
      classroom: Classroom;
      teacher: Teacher | null;
      enrolled: boolean;
    })[] = [];
    const upcoming: typeof live = [];

    for (const d of meetingsSnap.docs) {
      const m = { id: d.id, ...(d.data() as Omit<Meeting, "id">) };
      if (!relevantIds.has(m.classroomId)) continue;
      const classroom = relevant.find((c) => c.id === m.classroomId)!;
      teacherIds.add(m.teacherId);
      const enriched = {
        ...m,
        classroom,
        teacher: null as Teacher | null,
        enrolled: (classroom.studentIds ?? []).includes(user.uid),
      };
      if (m.status === "live") live.push(enriched);
      else upcoming.push(enriched);
    }

    // Fetch teachers in parallel
    const teacherMap = new Map<string, Teacher>();
    await Promise.all(
      Array.from(teacherIds).map(async (tid) => {
        const td = await adminDb.collection(Collections.USERS).doc(tid).get();
        if (td.exists) teacherMap.set(tid, td.data() as Teacher);
      }),
    );

    for (const m of [...live, ...upcoming]) {
      m.teacher = teacherMap.get(m.teacherId) ?? null;
    }

    live.sort((a, b) => (b.startedAt ?? "").localeCompare(a.startedAt ?? ""));
    upcoming.sort((a, b) => (a.startedAt ?? "").localeCompare(b.startedAt ?? ""));

    return ok({ live, upcoming });
  } catch (e) {
    return fail(e);
  }
}
