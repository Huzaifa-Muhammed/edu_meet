import "server-only";
import { adminDb } from "@/server/firebase-admin";
import { Collections } from "@/shared/constants/collections";
import { notFound, badRequest, forbidden } from "@/server/utils/errors";
import { resolveSubjectName } from "@/shared/constants/subjects";
import type {
  CoverRequest,
  CoverAcceptance,
  LeaveRequest,
} from "@/shared/types/domain";

function norm(s: string | undefined | null): string {
  return (s ?? "").trim().toLowerCase();
}

/** "HH:MM" → minutes since midnight (0 on malformed input). */
function toMinutes(time: string | undefined | null): number {
  const [h, m] = (time ?? "").split(":").map((n) => Number(n));
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

/** Do two same-day [start, start+dur) windows (in minutes) overlap? */
function windowsOverlap(
  aStart: number,
  aDur: number,
  bStart: number,
  bDur: number,
): boolean {
  return aStart < bStart + bDur && bStart < aStart + aDur;
}

type BusySlot = { date: string; start: number; dur: number };

/** A teacher's own committed class windows (non-ended, non-proposed),
 *  used to keep cover requests off their dashboard when they're already
 *  teaching at that time. */
async function teacherBusySlots(teacherId: string): Promise<BusySlot[]> {
  const snap = await adminDb
    .collection(Collections.MEETINGS)
    .where("teacherId", "==", teacherId)
    .get();
  const slots: BusySlot[] = [];
  for (const d of snap.docs) {
    const m = d.data() as Record<string, unknown>;
    if (m.status === "ended") continue;
    if (m.scheduleStatus === "proposed") continue; // tentative, not yet committed
    const date =
      (m.scheduledDate as string | undefined) ??
      (typeof m.startedAt === "string" ? (m.startedAt as string).slice(0, 10) : "");
    const time =
      (m.scheduledTime as string | undefined) ??
      (typeof m.startedAt === "string" ? (m.startedAt as string).slice(11, 16) : "");
    if (!date || !time) continue;
    slots.push({ date, start: toMinutes(time), dur: (m.durationMin as number | undefined) ?? 60 });
  }
  return slots;
}

/** True when the teacher already has a class clashing with this request's
 *  date/time window. */
function clashesWithOwnClass(
  busy: BusySlot[],
  cr: Pick<CoverRequest, "scheduledDate" | "scheduledTime" | "durationMin">,
): boolean {
  const start = toMinutes(cr.scheduledTime);
  const dur = cr.durationMin ?? 60;
  return busy.some(
    (b) => b.date === cr.scheduledDate && windowsOverlap(start, dur, b.start, b.dur),
  );
}

/** Every normalized subject a teacher can teach — union of `subjects`,
 *  `applicationSubject`, and `extraData.specializations`. Mirrors the
 *  candidate logic in the admin leave-coverage route. */
export function teacherSubjects(u: Record<string, unknown>): string[] {
  const extra = (u.extraData as { specializations?: string[] } | undefined) ?? {};
  return [
    ...((u.subjects as string[] | undefined) ?? []),
    u.applicationSubject as string | undefined,
    ...(extra.specializations ?? []),
  ]
    .filter((s): s is string => !!s)
    .map(norm);
}

function teacherDisplayName(u: Record<string, unknown>): string {
  return (
    (u.displayName as string | undefined) ??
    (u.name as string | undefined) ??
    (u.email as string | undefined) ??
    "Teacher"
  );
}

/** A teacher's own state on a cover request (computed per-viewer). */
type MyState = "open" | "accepted" | "won" | "lost";

export const coverService = {
  /** Broadcast a cover request for every class knocked out by an approved
   *  leave. Idempotent: doc id = `${leaveId}_${meetingId}`, existing ones are
   *  left untouched (so acceptances survive a re-run). */
  async broadcastForLeave(leave: LeaveRequest): Promise<{ created: number }> {
    const snap = await adminDb
      .collection(Collections.MEETINGS)
      .where("teacherId", "==", leave.teacherId)
      .get();

    const affected = snap.docs.filter((d) => {
      const m = d.data() as Record<string, unknown>;
      const date =
        (m.scheduledDate as string | undefined) ??
        (typeof m.startedAt === "string" ? (m.startedAt as string).slice(0, 10) : "");
      if (!date || date < leave.startDate || date > (leave.endDate || leave.startDate))
        return false;
      if (m.status === "ended") return false;
      if (m.scheduleStatus === "proposed") return false;
      return true;
    });

    // Subject fallback for manual meetings that carry no subjectName.
    const classroomIds = Array.from(
      new Set(
        affected
          .map((d) => (d.data() as Record<string, unknown>).classroomId as string | undefined)
          .filter((s): s is string => !!s),
      ),
    );
    const classroomSubject = new Map<string, string>();
    await Promise.all(
      classroomIds.map(async (cid) => {
        const c = await adminDb.collection(Collections.CLASSROOMS).doc(cid).get();
        if (c.exists) {
          const data = c.data() as { subjectId?: string; subjectName?: string };
          classroomSubject.set(
            cid,
            resolveSubjectName(data.subjectId ?? "", data.subjectName),
          );
        }
      }),
    );

    const now = new Date().toISOString();
    let created = 0;
    for (const d of affected) {
      const m = d.data() as Record<string, unknown>;
      const id = `${leave.id}_${d.id}`;
      const ref = adminDb.collection(Collections.COVER_REQUESTS).doc(id);
      const existing = await ref.get();
      if (existing.exists) continue;

      const date =
        (m.scheduledDate as string | undefined) ??
        (typeof m.startedAt === "string" ? (m.startedAt as string).slice(0, 10) : "");
      const time =
        (m.scheduledTime as string | undefined) ??
        (typeof m.startedAt === "string" ? (m.startedAt as string).slice(11, 16) : "");
      const subjectName =
        (m.subjectName as string | undefined) ||
        classroomSubject.get(m.classroomId as string) ||
        "";

      const payload: Omit<CoverRequest, "id"> = {
        meetingId: d.id,
        leaveId: leave.id,
        originalTeacherId: leave.teacherId,
        originalTeacherName: leave.teacherName,
        subjectName,
        classTitle: (m.title as string | undefined) || subjectName || "Class",
        scheduledDate: date,
        scheduledTime: time,
        durationMin: (m.durationMin as number | undefined) ?? 60,
        status: "open",
        acceptances: [],
        assignedTeacherId: null,
        assignedTeacherName: null,
        resolvedAt: null,
        resolvedBy: null,
        createdAt: now,
      };
      await ref.set(payload);
      created++;
    }
    return { created };
  },

  /** Cover requests relevant to one teacher: open ones matching their
   *  subject they can grab, plus any they've already accepted / won / lost. */
  async listForTeacher(
    teacherId: string,
  ): Promise<(CoverRequest & { myState: MyState })[]> {
    const userDoc = await adminDb.collection(Collections.USERS).doc(teacherId).get();
    const subjects = new Set(teacherSubjects(userDoc.data() ?? {}));
    const busy = await teacherBusySlots(teacherId);

    const snap = await adminDb.collection(Collections.COVER_REQUESTS).get();
    const out: (CoverRequest & { myState: MyState })[] = [];
    for (const d of snap.docs) {
      const cr = { id: d.id, ...(d.data() as Omit<CoverRequest, "id">) };
      if (cr.originalTeacherId === teacherId) continue; // never your own class
      if (cr.status === "cancelled") continue;

      const iAccepted = (cr.acceptances ?? []).some((a) => a.teacherId === teacherId);
      const subjectMatch = subjects.has(norm(cr.subjectName));
      // Don't offer a class they can't actually take — already teaching then.
      const free = !clashesWithOwnClass(busy, cr);

      let myState: MyState | null = null;
      if (cr.assignedTeacherId === teacherId) myState = "won";
      else if (cr.status === "assigned" && iAccepted) myState = "lost";
      else if (iAccepted) myState = "accepted";
      else if (cr.status === "open" && subjectMatch && free) myState = "open";

      if (!myState) continue;
      out.push({ ...cr, myState });
    }
    out.sort((a, b) =>
      `${a.scheduledDate}T${a.scheduledTime}`.localeCompare(
        `${b.scheduledDate}T${b.scheduledTime}`,
      ),
    );
    return out;
  },

  /** Teacher accepts a cover request. Atomic via a transaction:
   *  first acceptor on an OPEN request wins (meeting reassigned instantly);
   *  any later acceptor flips it to CONTESTED for an admin to decide. */
  async accept(
    coverId: string,
    teacher: { uid: string; displayName?: string; email?: string },
  ): Promise<{ outcome: "assigned" | "contested" | "cancelled" }> {
    // Authorize by subject + own-schedule availability before contending.
    const userDoc = await adminDb.collection(Collections.USERS).doc(teacher.uid).get();
    const subjects = new Set(teacherSubjects(userDoc.data() ?? {}));
    const busy = await teacherBusySlots(teacher.uid);

    const coverRef = adminDb.collection(Collections.COVER_REQUESTS).doc(coverId);
    const name = teacher.displayName ?? teacher.email ?? "Teacher";
    const now = new Date().toISOString();

    return adminDb.runTransaction(async (tx) => {
      const coverSnap = await tx.get(coverRef);
      if (!coverSnap.exists) throw notFound("Cover request");
      const cr = coverSnap.data() as Omit<CoverRequest, "id">;

      if (cr.originalTeacherId === teacher.uid)
        throw forbidden("You can't cover your own class");
      if (!subjects.has(norm(cr.subjectName)))
        throw forbidden("This class isn't in your subjects");
      if (clashesWithOwnClass(busy, cr))
        throw forbidden("You already have a class at that time");
      if (cr.status === "cancelled") return { outcome: "cancelled" as const };

      const meetingRef = adminDb.collection(Collections.MEETINGS).doc(cr.meetingId);
      const meetingSnap = await tx.get(meetingRef);

      const already = (cr.acceptances ?? []).some((a) => a.teacherId === teacher.uid);
      const acceptance: CoverAcceptance = {
        teacherId: teacher.uid,
        teacherName: name,
        acceptedAt: now,
      };

      // Already assigned to this teacher — idempotent success.
      if (cr.assignedTeacherId === teacher.uid) return { outcome: "assigned" as const };

      if (cr.status === "open") {
        // First taker wins → assign + reassign the meeting in the same txn.
        tx.update(coverRef, {
          status: "assigned",
          assignedTeacherId: teacher.uid,
          assignedTeacherName: name,
          acceptances: [acceptance],
          resolvedAt: now,
          resolvedBy: "auto",
        });
        if (meetingSnap.exists) {
          const md = meetingSnap.data() ?? {};
          const originalTeacherId =
            (md.originalTeacherId as string | undefined) ?? (md.teacherId as string);
          tx.update(meetingRef, {
            teacherId: teacher.uid,
            originalTeacherId,
            substituteTeacherId: teacher.uid,
            reassignedAt: now,
            reassignedBy: "auto",
          });
        }
        return { outcome: "assigned" as const };
      }

      // status is "assigned" (to someone else) or "contested": a rival taker.
      if (!already) {
        tx.update(coverRef, {
          status: "contested",
          acceptances: [...(cr.acceptances ?? []), acceptance],
        });
      } else if (cr.status === "assigned") {
        // edge: they accepted but it got auto-assigned to a faster rival
        tx.update(coverRef, { status: "contested" });
      }
      return { outcome: "contested" as const };
    });
  },

  /** Admin view: cover requests by status (default all non-cancelled),
   *  newest first. */
  async listForAdmin(
    status?: CoverRequest["status"],
  ): Promise<CoverRequest[]> {
    const snap = await adminDb.collection(Collections.COVER_REQUESTS).get();
    let rows = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<CoverRequest, "id">),
    }));
    rows = status
      ? rows.filter((r) => r.status === status)
      : rows.filter((r) => r.status !== "cancelled");
    rows.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
    return rows;
  },

  async countContested(): Promise<number> {
    const snap = await adminDb
      .collection(Collections.COVER_REQUESTS)
      .where("status", "==", "contested")
      .get();
    return snap.size;
  },

  /** Admin resolves a contested request by choosing one accepting teacher. */
  async resolve(
    coverId: string,
    adminUid: string,
    teacherId: string,
  ): Promise<{ id: string; assignedTeacherId: string }> {
    const coverRef = adminDb.collection(Collections.COVER_REQUESTS).doc(coverId);
    const now = new Date().toISOString();

    return adminDb.runTransaction(async (tx) => {
      const coverSnap = await tx.get(coverRef);
      if (!coverSnap.exists) throw notFound("Cover request");
      const cr = coverSnap.data() as Omit<CoverRequest, "id">;

      const picked = (cr.acceptances ?? []).find((a) => a.teacherId === teacherId);
      if (!picked) throw badRequest("That teacher didn't accept this request");

      const meetingRef = adminDb.collection(Collections.MEETINGS).doc(cr.meetingId);
      const meetingSnap = await tx.get(meetingRef);

      tx.update(coverRef, {
        status: "assigned",
        assignedTeacherId: teacherId,
        assignedTeacherName: picked.teacherName,
        resolvedAt: now,
        resolvedBy: adminUid,
      });
      if (meetingSnap.exists) {
        const md = meetingSnap.data() ?? {};
        const originalTeacherId =
          (md.originalTeacherId as string | undefined) ?? (md.teacherId as string);
        tx.update(meetingRef, {
          teacherId,
          originalTeacherId,
          substituteTeacherId: teacherId,
          reassignedAt: now,
          reassignedBy: adminUid,
        });
      }
      return { id: coverId, assignedTeacherId: teacherId };
    });
  },
};
