export const dynamic = "force-dynamic";
import "server-only";
import { NextRequest } from "next/server";
import { z } from "zod";
import { verifyToken } from "@/server/auth/verify-token";
import { requireRole } from "@/server/auth/require-role";
import { classQuestionsService } from "@/server/services/class-questions.service";
import { ok, fail } from "@/server/utils/response";
import { badRequest } from "@/server/utils/errors";

const PatchSchema = z.object({
  status: z.enum(["pending", "answered", "dismissed"]).optional(),
  pinned: z.boolean().optional(),
  aiAnswer: z.string().min(1).max(4000).optional(),
});

/** Teacher/admin-only: mark answered / pin / dismiss. */
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; qid: string }> },
) {
  try {
    const user = await verifyToken(req);
    requireRole(user, ["teacher", "admin"]);
    const { id, qid } = await ctx.params;

    const body = await req.json().catch(() => ({}));
    const parsed = PatchSchema.safeParse(body);
    if (!parsed.success) throw badRequest("Invalid patch body");

    const q = await classQuestionsService.update(id, qid, parsed.data);
    return ok(q);
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; qid: string }> },
) {
  try {
    const user = await verifyToken(req);
    requireRole(user, ["teacher", "admin"]);
    const { id, qid } = await ctx.params;
    await classQuestionsService.remove(id, qid);
    return ok({ removed: qid });
  } catch (e) {
    return fail(e);
  }
}
