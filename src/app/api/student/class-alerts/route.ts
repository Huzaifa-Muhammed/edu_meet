export const dynamic = "force-dynamic";
import "server-only";
import { NextRequest } from "next/server";
import { verifyToken } from "@/server/auth/verify-token";
import { requireRole } from "@/server/auth/require-role";
import { adminDb } from "@/server/firebase-admin";
import { Collections } from "@/shared/constants/collections";
import { relevantClassrooms } from "@/server/services/student-classes.service";
import { ok, fail } from "@/server/utils/response";
import type { ClassAlert } from "@/lib/schedule/class-window";

function ymdOffset(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Student counterpart of the class-alert feed. Returns published scheduled/live
 * classes (today ± 1 day) for classrooms the student is enrolled in or
 * subject-matched to — the SAME matching as the live-classes dashboard feed, so
 * reminders line up exactly with what's on their dashboard. `enrolled` drives
 * whether the popup's Join can deep-link straight into the classroom.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await verifyToken(req);
    requireRole(user, ["student"]);

    const { classrooms, enrolledIds } = await relevantClassrooms(user.uid);
    const byId = new Map(classrooms.map((c) => [c.id, c]));
    if (byId.size === 0) return ok({ alerts: [] });

    const meetingsSnap = await adminDb
      .collection(Collections.MEETINGS)
      .where("status", "in", ["scheduled", "live"])
      .get();

    const from = ymdOffset(-1);
    const to = ymdOffset(1);

    const alerts: ClassAlert[] = [];
    for (const d of meetingsSnap.docs) {
      const m = d.data() as {
        classroomId?: string;
        status?: string;
        scheduleStatus?: string;
        scheduledDate?: string;
        startedAt?: string;
        scheduledTime?: string;
        durationMin?: number;
        subjectName?: string;
      };
      if (!m.classroomId || !byId.has(m.classroomId)) continue;
      if (m.scheduleStatus === "proposed") continue; // teacher-only until approved
      const date = m.scheduledDate ?? m.startedAt?.slice(0, 10);
      const time = m.scheduledTime ?? m.startedAt?.slice(11, 16);
      if (!date || !time) continue;
      if (date < from || date > to) continue;
      const c = byId.get(m.classroomId)!;
      alerts.push({
        meetingId: d.id,
        classroomName: c.name,
        subjectName: m.subjectName ?? c.subjectName ?? "",
        scheduledDate: date,
        scheduledTime: time,
        durationMin: m.durationMin ?? 60,
        status: m.status ?? "scheduled",
        enrolled: enrolledIds.has(m.classroomId),
      });
    }

    return ok({ alerts });
  } catch (e) {
    return fail(e);
  }
}
