export const dynamic = "force-dynamic";
import "server-only";
import { NextRequest } from "next/server";
import { verifyToken } from "@/server/auth/verify-token";
import { requireRole } from "@/server/auth/require-role";
import { adminDb } from "@/server/firebase-admin";
import { Collections } from "@/shared/constants/collections";
import { relevantClassrooms, type RelevantClassroom } from "@/server/services/student-classes.service";
import { ok, fail } from "@/server/utils/response";

type Classroom = RelevantClassroom;

type Meeting = {
  id: string;
  classroomId: string;
  status: string;
  scheduleStatus?: string;
  approvedAt?: string;
  startedAt?: string;
  teacherId: string;
  videosdkRoomId?: string | null;
};

type Teacher = { displayName?: string; email?: string; photoUrl?: string };

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
    const scheduleSeenAt = (userDoc.data()?.scheduleSeenAt as string | undefined) ?? "";

    const { classrooms: relevant } = await relevantClassrooms(user.uid);
    const relevantIds = new Set(relevant.map((c) => c.id));
    if (relevantIds.size === 0)
      return ok({
        live: [],
        upcoming: [],
        newSchedule: { available: false, at: "", subjects: [] },
      });

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
      // Unapproved AI proposals are teacher-only — never surfaced to students.
      if (m.status === "scheduled" && m.scheduleStatus === "proposed") continue;
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

    // "New schedule ready" signal: any newly-approved upcoming class (in the
    // student's subjects / enrolled) approved after they last looked.
    let newestApprovedAt = "";
    const newSubjects = new Set<string>();
    for (const m of upcoming) {
      const approvedAt = m.approvedAt;
      if (!approvedAt || approvedAt <= scheduleSeenAt) continue;
      if (approvedAt > newestApprovedAt) newestApprovedAt = approvedAt;
      if (m.classroom.subjectName) newSubjects.add(m.classroom.subjectName);
    }
    const newSchedule = {
      available: !!newestApprovedAt,
      at: newestApprovedAt,
      subjects: Array.from(newSubjects),
    };

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

    return ok({ live, upcoming, newSchedule });
  } catch (e) {
    return fail(e);
  }
}
