export const dynamic = "force-dynamic";
import "server-only";
import { NextRequest } from "next/server";
import { verifyToken } from "@/server/auth/verify-token";
import { requireRole } from "@/server/auth/require-role";
import { coverService } from "@/server/services/cover.service";
import { ok, fail } from "@/server/utils/response";

/** Teacher accepts a cover request. First taker auto-wins; a later taker
 *  flips it to "contested" for an admin to decide. */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const user = await verifyToken(req);
    requireRole(user, ["teacher"]);
    const { id } = await ctx.params;
    const result = await coverService.accept(id, {
      uid: user.uid,
      displayName: user.displayName,
      email: user.email,
    });
    return ok(result);
  } catch (e) {
    return fail(e);
  }
}
