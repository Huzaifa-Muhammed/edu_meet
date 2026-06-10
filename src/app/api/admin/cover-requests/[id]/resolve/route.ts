export const dynamic = "force-dynamic";
import "server-only";
import { NextRequest } from "next/server";
import { verifyToken } from "@/server/auth/verify-token";
import { requireRole } from "@/server/auth/require-role";
import { coverService } from "@/server/services/cover.service";
import { CoverResolveSchema } from "@/shared/schemas/cover.schema";
import { ok, fail } from "@/server/utils/response";

/** Admin resolves a contested cover request by choosing one accepting teacher. */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await verifyToken(req);
    requireRole(auth, ["admin"]);
    const { id } = await ctx.params;
    const { teacherId } = CoverResolveSchema.parse(await req.json());
    const result = await coverService.resolve(id, auth.uid, teacherId);
    return ok(result);
  } catch (e) {
    return fail(e);
  }
}
