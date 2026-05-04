export const dynamic = "force-dynamic";
import "server-only";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { verifyToken } from "@/server/auth/verify-token";
import { requireRole } from "@/server/auth/require-role";
import { supportService } from "@/server/services/support.service";
import { ok, fail } from "@/server/utils/response";

const PatchSchema = z.object({
  status: z.enum(["open", "resolved"]),
});

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await verifyToken(req);
    requireRole(auth, ["admin"]);
    const { id } = await ctx.params;
    const body = PatchSchema.parse(await req.json());
    const result = await supportService.setStatus(id, body.status);
    return ok(result);
  } catch (e) {
    return fail(e);
  }
}
