export const dynamic = "force-dynamic";
import "server-only";
import { NextRequest } from "next/server";
import { verifyToken } from "@/server/auth/verify-token";
import { requireRole } from "@/server/auth/require-role";
import { adminDb } from "@/server/firebase-admin";
import { Collections } from "@/shared/constants/collections";
import { ok, fail } from "@/server/utils/response";
import type { ClassAlert } from "@/lib/schedule/class-window";

/** ISO date N days from today (server-UTC). Generous ±1 window so the client,
 *  which does the precise local-time math, never misses an edge-of-midnight class. */
function ymdOffset(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Lightweight feed for the global "class starts soon / live now" reminder popup.
 * Returns this teacher's published (non-proposed) scheduled/live classes within
 * today ± 1 day. The client decides what is imminent/ongoing in local time.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await verifyToken(req);
    requireRole(user, ["teacher"]);

    const [meetingsSnap, classroomsSnap] = await Promise.all([
      adminDb.collection(Collections.MEETINGS).where("teacherId", "==", user.uid).get(),
      adminDb.collection(Collections.CLASSROOMS).where("teacherId", "==", user.uid).get(),
    ]);

    const nameById = new Map<string, { name: string; subjectName: string }>();
    for (const d of classroomsSnap.docs) {
      const c = d.data() as { name?: string; subjectName?: string };
      nameById.set(d.id, { name: c.name ?? "Class", subjectName: c.subjectName ?? "" });
    }

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
        title?: string;
      };
      if (m.scheduleStatus === "proposed") continue;
      if (m.status !== "scheduled" && m.status !== "live") continue;
      const date = m.scheduledDate ?? m.startedAt?.slice(0, 10);
      const time = m.scheduledTime ?? m.startedAt?.slice(11, 16);
      if (!date || !time) continue;
      if (date < from || date > to) continue;
      const meta = m.classroomId ? nameById.get(m.classroomId) : undefined;
      alerts.push({
        meetingId: d.id,
        classroomName: meta?.name ?? m.title ?? "Class",
        subjectName: m.subjectName ?? meta?.subjectName ?? "",
        scheduledDate: date,
        scheduledTime: time,
        durationMin: m.durationMin ?? 60,
        status: m.status ?? "scheduled",
      });
    }

    return ok({ alerts });
  } catch (e) {
    return fail(e);
  }
}
