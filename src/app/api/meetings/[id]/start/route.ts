export const dynamic = "force-dynamic";
import "server-only";
import { NextRequest } from "next/server";
import { verifyToken } from "@/server/auth/verify-token";
import { requireRole } from "@/server/auth/require-role";
import { meetingsService } from "@/server/services/meetings.service";
import { ok, fail } from "@/server/utils/response";
import { forbidden } from "@/server/utils/errors";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const user = await verifyToken(req);
    requireRole(user, ["teacher"]);
    const { id } = await ctx.params;

    const meeting = (await meetingsService.getById(id)) as unknown as {
      teacherId: string;
    };
    if (meeting.teacherId !== user.uid) throw forbidden("Not your meeting");

    const result = await meetingsService.markLive(id);
    return ok(result);
  } catch (e) {
    return fail(e);
  }
}
