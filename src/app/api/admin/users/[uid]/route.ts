export const dynamic = "force-dynamic";
import "server-only";
import type { NextRequest } from "next/server";
import { verifyToken } from "@/server/auth/verify-token";
import { requireRole } from "@/server/auth/require-role";
import { usersService } from "@/server/services/users.service";
import { ok, fail } from "@/server/utils/response";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ uid: string }> },
) {
  try {
    const auth = await verifyToken(req);
    requireRole(auth, ["admin"]);
    const { uid } = await ctx.params;
    const data = await usersService.getDetail(uid);
    return ok(data);
  } catch (e) {
    return fail(e);
  }
}
