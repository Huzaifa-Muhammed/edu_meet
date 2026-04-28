export const dynamic = "force-dynamic";
import "server-only";
import { NextRequest } from "next/server";
import { verifyToken } from "@/server/auth/verify-token";
import { requireRole } from "@/server/auth/require-role";
import { classNotesService } from "@/server/services/class-notes.service";
import { ok, fail } from "@/server/utils/response";

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; noteId: string }> },
) {
  try {
    const user = await verifyToken(req);
    requireRole(user, ["teacher", "admin"]);
    const { id, noteId } = await ctx.params;
    await classNotesService.remove(id, noteId);
    return ok({ removed: noteId });
  } catch (e) {
    return fail(e);
  }
}
