export const dynamic = "force-dynamic";
import "server-only";
import { NextRequest } from "next/server";
import { verifyToken } from "@/server/auth/verify-token";
import { adminDb } from "@/server/firebase-admin";
import { Collections } from "@/shared/constants/collections";
import { classroomsService } from "@/server/services/classrooms.service";
import { ok, fail } from "@/server/utils/response";
import { forbidden } from "@/server/utils/errors";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const user = await verifyToken(req);
    const { id } = await ctx.params;
    const classroom = (await classroomsService.getById(id)) as unknown as {
      teacherId: string;
      studentIds?: string[];
    };

    if (user.role === "teacher" && classroom.teacherId !== user.uid) {
      throw forbidden("Not your classroom");
    }

    const ids = classroom.studentIds ?? [];
    if (!ids.length) return ok([]);

    const chunks: string[][] = [];
    for (let i = 0; i < ids.length; i += 10) chunks.push(ids.slice(i, i + 10));

    const students: Array<{ uid: string; displayName?: string; email?: string; photoUrl?: string }> = [];
    for (const batch of chunks) {
      const snap = await adminDb
        .collection(Collections.USERS)
        .where("__name__", "in", batch)
        .get();
      for (const d of snap.docs) {
        const data = d.data();
        students.push({
          uid: d.id,
          displayName: data.displayName,
          email: data.email,
          photoUrl: data.photoUrl,
        });
      }
    }

    return ok(students);
  } catch (e) {
    return fail(e);
  }
}
