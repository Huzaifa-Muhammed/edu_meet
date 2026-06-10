export const dynamic = "force-dynamic";
import "server-only";
import { NextRequest } from "next/server";
import { verifyToken } from "@/server/auth/verify-token";
import { requireRole } from "@/server/auth/require-role";
import { leaveService } from "@/server/services/leave.service";
import { coverService } from "@/server/services/cover.service";
import { LeaveReviewSchema } from "@/shared/schemas/leave.schema";
import { ok, fail } from "@/server/utils/response";

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await verifyToken(req);
    requireRole(auth, ["admin"]);
    const { id } = await ctx.params;
    const body = LeaveReviewSchema.parse(await req.json());
    const result = await leaveService.review(id, auth.uid, body);

    // On approval, broadcast a cover request for every class on the leave
    // dates so same-subject teachers can pick them up.
    let broadcast = 0;
    if (body.status === "approved") {
      const leave = await leaveService.getById(id);
      const res = await coverService.broadcastForLeave(leave);
      broadcast = res.created;
    }

    return ok({ ...result, coverRequestsBroadcast: broadcast });
  } catch (e) {
    return fail(e);
  }
}
