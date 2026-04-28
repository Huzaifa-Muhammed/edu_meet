export const dynamic = "force-dynamic";
import "server-only";
import { NextRequest } from "next/server";
import { z } from "zod";
import { verifyToken } from "@/server/auth/verify-token";
import { requireRole } from "@/server/auth/require-role";
import { classNotesService } from "@/server/services/class-notes.service";
import { ok, fail } from "@/server/utils/response";
import { badRequest } from "@/server/utils/errors";

const NoteSchema = z.object({
  text: z.string().min(1).max(4000),
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

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const user = await verifyToken(req);
    requireRole(user, ["teacher", "admin"]);
    const { id } = await ctx.params;

    const body = await req.json().catch(() => ({}));
    const parsed = NoteSchema.safeParse(body);
    if (!parsed.success) throw badRequest("Invalid note body");

    const note = await classNotesService.add({
      classroomId: id,
      text: parsed.data.text,
      authorId: user.uid,
      authorName: user.displayName ?? user.email ?? "Teacher",
      authorRole: user.role === "admin" ? "admin" : "teacher",
    });
    return ok(note);
  } catch (e) {
    return fail(e);
  }
}
