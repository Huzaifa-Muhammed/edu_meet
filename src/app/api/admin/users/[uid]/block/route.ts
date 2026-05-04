export const dynamic = "force-dynamic";
import "server-only";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { verifyToken } from "@/server/auth/verify-token";
import { requireRole } from "@/server/auth/require-role";
import { usersService } from "@/server/services/users.service";
import { ok, fail } from "@/server/utils/response";
import { badRequest } from "@/server/utils/errors";

const BlockSchema = z.object({
  blocked: z.boolean(),
  reason: z.string().max(300).optional(),
});

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ uid: string }> },
) {
  try {
    const auth = await verifyToken(req);
    requireRole(auth, ["admin"]);
    const { uid } = await ctx.params;
    if (uid === auth.uid) {
      throw badRequest("Admins cannot block themselves");
    }
    const body = BlockSchema.parse(await req.json());
    const result = await usersService.setBlocked(uid, body.blocked, body.reason);
    return ok(result);
  } catch (e) {
    return fail(e);
  }
}
