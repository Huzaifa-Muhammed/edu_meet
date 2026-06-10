export const dynamic = "force-dynamic";
import "server-only";
import { NextRequest } from "next/server";
import { verifyToken } from "@/server/auth/verify-token";
import { requireRole } from "@/server/auth/require-role";
import { adminDb } from "@/server/firebase-admin";
import { Collections } from "@/shared/constants/collections";
import { leaveService } from "@/server/services/leave.service";
import { ok, fail } from "@/server/utils/response";

function norm(s?: string) {
  return (s ?? "").trim().toLowerCase();
}

/** For an admin covering a teacher's leave: the classes that fall on the
 *  leave dates + the teachers who could substitute (same-subject first). */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await verifyToken(req);
    requireRole(auth, ["admin"]);
    const { id } = await ctx.params;
    const leave = await leaveService.getById(id);

    // Classes currently owned by the teacher OR already substituted away.
    const [q1, q2] = await Promise.all([
      adminDb.collection(Collections.MEETINGS).where("teacherId", "==", leave.teacherId).get(),
      adminDb
        .collection(Collections.MEETINGS)
        .where("originalTeacherId", "==", leave.teacherId)
        .get(),
    ]);

    const seen = new Set<string>();
    const meetings: {
      id: string;
      title: string;
      subjectName: string;
      scheduledDate: string;
      scheduledTime: string;
      currentTeacherId: string;
      substituteTeacherId: string | null;
    }[] = [];
    for (const d of [...q1.docs, ...q2.docs]) {
      if (seen.has(d.id)) continue;
      seen.add(d.id);
      const m = d.data() as Record<string, unknown>;
      const date =
        (m.scheduledDate as string | undefined) ??
        (typeof m.startedAt === "string" ? (m.startedAt as string).slice(0, 10) : "");
      if (!date || date < leave.startDate || date > leave.endDate) continue;
      if (m.status === "ended") continue;
      if (m.scheduleStatus === "proposed") continue;
      meetings.push({
        id: d.id,
        title: (m.title as string) ?? "Class",
        subjectName: (m.subjectName as string) ?? "",
        scheduledDate: date,
        scheduledTime:
          (m.scheduledTime as string | undefined) ??
          (typeof m.startedAt === "string" ? (m.startedAt as string).slice(11, 16) : ""),
        currentTeacherId: m.teacherId as string,
        substituteTeacherId: (m.substituteTeacherId as string | undefined) ?? null,
      });
    }
    meetings.sort((a, b) =>
      `${a.scheduledDate}T${a.scheduledTime}`.localeCompare(`${b.scheduledDate}T${b.scheduledTime}`),
    );

    const subjectSet = new Set(meetings.map((m) => norm(m.subjectName)).filter(Boolean));

    const usersSnap = await adminDb
      .collection(Collections.USERS)
      .where("role", "==", "teacher")
      .get();
    const candidates = usersSnap.docs
      .filter((d) => d.id !== leave.teacherId)
      .map((d) => {
        const u = d.data() as Record<string, unknown>;
        const status = (u.status as string | undefined) ?? (u.applicationStatus as string | undefined);
        const extra = (u.extraData as { specializations?: string[] } | undefined) ?? {};
        const subs = [
          ...((u.subjects as string[] | undefined) ?? []),
          u.applicationSubject as string | undefined,
          ...(extra.specializations ?? []),
        ]
          .filter((s): s is string => !!s)
          .map(norm);
        return {
          uid: d.id,
          name:
            (u.displayName as string | undefined) ??
            (u.name as string | undefined) ??
            (u.email as string | undefined) ??
            "Teacher",
          approved: status === "approved",
          sameSubject: subs.some((s) => subjectSet.has(s)),
        };
      })
      .filter((c) => c.approved);
    candidates.sort(
      (a, b) => (b.sameSubject ? 1 : 0) - (a.sameSubject ? 1 : 0) || a.name.localeCompare(b.name),
    );

    return ok({ leave, meetings, candidates });
  } catch (e) {
    return fail(e);
  }
}
