export const dynamic = "force-dynamic";
import "server-only";
import { NextRequest } from "next/server";
import { verifyToken } from "@/server/auth/verify-token";
import { requireRole } from "@/server/auth/require-role";
import { meetingsService } from "@/server/services/meetings.service";
import { ok, fail } from "@/server/utils/response";
import { forbidden } from "@/server/utils/errors";

/** Real end-of-class insights for the host teacher (duration, attendance,
 *  questions). Used by the session wrap-up modal. */
export async function GET(
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

    const insights = await meetingsService.getInsights(id);
    return ok(insights);
  } catch (e) {
    return fail(e);
  }
}
