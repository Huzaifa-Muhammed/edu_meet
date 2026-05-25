export const dynamic = "force-dynamic";
import "server-only";
import { NextRequest } from "next/server";
import { verifyToken } from "@/server/auth/verify-token";
import { requireRole } from "@/server/auth/require-role";
import { adminDb } from "@/server/firebase-admin";
import { Collections } from "@/shared/constants/collections";
import { ok, fail } from "@/server/utils/response";

type StudentRow = {
  uid: string;
  displayName?: string;
  email?: string;
  photoUrl?: string;
  classroomIds: string[];
  classroomNames: string[];
  subjects: string[];
  enrolledSince?: string;
  blocked?: boolean;
};

export async function GET(req: NextRequest) {
  try {
    const user = await verifyToken(req);
    requireRole(user, ["teacher"]);

    const classroomsSnap = await adminDb
      .collection(Collections.CLASSROOMS)
      .where("teacherId", "==", user.uid)
      .get();
    const classrooms = classroomsSnap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as { name?: string; studentIds?: string[]; createdAt?: string }),
    }));

    const studentMap = new Map<
      string,
      { classroomIds: string[]; classroomNames: string[]; earliestAt?: string }
    >();
    for (const c of classrooms) {
      for (const sid of c.studentIds ?? []) {
        const entry =
          studentMap.get(sid) ?? {
            classroomIds: [],
            classroomNames: [],
            earliestAt: c.createdAt,
          };
        entry.classroomIds.push(c.id);
        entry.classroomNames.push(c.name ?? "Class");
        if (c.createdAt && (!entry.earliestAt || c.createdAt < entry.earliestAt)) {
          entry.earliestAt = c.createdAt;
        }
        studentMap.set(sid, entry);
      }
    }

    const studentIds = [...studentMap.keys()];
    if (!studentIds.length) return ok([]);

    const profileMap = new Map<
      string,
      { displayName?: string; email?: string; photoUrl?: string; subjects?: string[]; blocked?: boolean }
    >();
    for (let i = 0; i < studentIds.length; i += 10) {
      const batch = studentIds.slice(i, i + 10);
      const snap = await adminDb
        .collection(Collections.USERS)
        .where("__name__", "in", batch)
        .get();
      for (const d of snap.docs) {
        const data = d.data();
        profileMap.set(d.id, {
          displayName: data.displayName,
          email: data.email,
          photoUrl: data.photoUrl,
          subjects: data.subjects,
          blocked: data.blocked,
        });
      }
    }

    const rows: StudentRow[] = studentIds.map((uid) => {
      const enr = studentMap.get(uid)!;
      const p = profileMap.get(uid) ?? {};
      return {
        uid,
        displayName: p.displayName,
        email: p.email,
        photoUrl: p.photoUrl,
        classroomIds: enr.classroomIds,
        classroomNames: enr.classroomNames,
        subjects: p.subjects ?? [],
        enrolledSince: enr.earliestAt,
        blocked: p.blocked,
      };
    });

    rows.sort((a, b) =>
      (a.displayName ?? a.email ?? "").localeCompare(
        b.displayName ?? b.email ?? "",
      ),
    );
    return ok(rows);
  } catch (e) {
    return fail(e);
  }
}
