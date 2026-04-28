export const dynamic = "force-dynamic";
import "server-only";
import { NextRequest } from "next/server";
import { verifyToken } from "@/server/auth/verify-token";
import { requireRole } from "@/server/auth/require-role";
import { resourcesService } from "@/server/services/resources.service";
import { ok, fail } from "@/server/utils/response";

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; itemId: string }> },
) {
  try {
    const user = await verifyToken(req);
    requireRole(user, ["teacher", "admin"]);
    const { id, itemId } = await ctx.params;
    await resourcesService.remove(id, itemId);
    return ok({ removed: true });
  } catch (e) {
    return fail(e);
  }
}
