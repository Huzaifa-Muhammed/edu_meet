export const dynamic = "force-dynamic";
import "server-only";
import { NextRequest } from "next/server";
import { z } from "zod";
import { verifyToken } from "@/server/auth/verify-token";
import { adminDb } from "@/server/firebase-admin";
import { Collections } from "@/shared/constants/collections";
import { classNotesService } from "@/server/services/class-notes.service";
import { ok, fail } from "@/server/utils/response";
import { badRequest, forbidden, notFound } from "@/server/utils/errors";

const NoteSchema = z.object({
  text: z.string().min(1).max(4000),
  /** When a student is sharing one of their private notes, sending this
   *  id lets the server flip its `shared` flag so the share button
   *  disappears in the student UI. */
  studentNoteId: z.string().min(1).max(64).optional(),
  meetingId: z.string().min(1).max(64).optional(),
});

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    await verifyToken(req);
    const { id } = await ctx.params;
    const list = await classNotesService.list(id);
    return ok(list);
  } catch (e) {
    return fail(e);
  }
}

/** Teacher / admin can post a class note unconditionally. A student can
 *  also share a note as long as they're enrolled in this classroom. */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const user = await verifyToken(req);
    const { id } = await ctx.params;

    const body = await req.json().catch(() => ({}));
    const parsed = NoteSchema.safeParse(body);
    if (!parsed.success) throw badRequest("Invalid note body");

    const role = user.role;
    if (role !== "teacher" && role !== "admin" && role !== "student") {
      throw forbidden("Not allowed to post notes");
    }

    if (role === "student") {
      const classDoc = await adminDb
        .collection(Collections.CLASSROOMS)
        .doc(id)
        .get();
      if (!classDoc.exists) throw notFound("Classroom");
      const studentIds: string[] = (classDoc.data()?.studentIds ?? []) as string[];
      if (!studentIds.includes(user.uid)) {
        throw forbidden("You aren't enrolled in this classroom");
      }
    }

    const note = await classNotesService.add({
      classroomId: id,
      text: parsed.data.text,
      authorId: user.uid,
      authorName:
        user.displayName ??
        user.email ??
        (role === "student" ? "Student" : "Teacher"),
      authorRole: role,
    });

    // If a student is "promoting" one of their private notes, flip the
    // shared flag so the UI hides the Share button on that row.
    if (role === "student" && parsed.data.studentNoteId && parsed.data.meetingId) {
      try {
        await adminDb
          .collection(Collections.STUDENT_NOTES)
          .doc(user.uid)
          .collection(parsed.data.meetingId)
          .doc(parsed.data.studentNoteId)
          .update({ shared: true, sharedAt: new Date().toISOString() });
      } catch {
        // best-effort — the class note still made it through
      }
    }

    return ok(note);
  } catch (e) {
    return fail(e);
  }
}
