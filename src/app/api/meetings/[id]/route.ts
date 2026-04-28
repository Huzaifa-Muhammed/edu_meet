export const dynamic = "force-dynamic";
import "server-only";
import { NextRequest } from "next/server";
import { verifyToken } from "@/server/auth/verify-token";
import { meetingsService } from "@/server/services/meetings.service";
import { ok, fail } from "@/server/utils/response";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    await verifyToken(req);
    const { id } = await ctx.params;
    const meeting = await meetingsService.getById(id);
    return ok(meeting);
  } catch (e) {
    return fail(e);
  }
}
