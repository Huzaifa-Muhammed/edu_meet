export const dynamic = "force-dynamic";
import "server-only";
import { NextRequest } from "next/server";
import { z } from "zod";
import { verifyToken } from "@/server/auth/verify-token";
import { meetingsService } from "@/server/services/meetings.service";
import { ok, fail } from "@/server/utils/response";

const ActionBody = z.object({
  uid: z.string().min(1),
  action: z.enum(["approve", "deny"]),
});

/** Teacher-only: list pending rejoin requests for this meeting. */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const user = await verifyToken(req);
    const { id } = await ctx.params;
    const items = await meetingsService.listPendingRejoinRequests(id, user.uid);
    return ok(items);
  } catch (e) {
    return fail(e);
  }
}

/** Teacher-only: approve (unbans + resolves) or deny (keeps ban) a request. */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const user = await verifyToken(req);
    const { id } = await ctx.params;
    const body = ActionBody.parse(await req.json());
    const result =
      body.action === "approve"
        ? await meetingsService.approveRejoinRequest(id, body.uid, user.uid)
        : await meetingsService.denyRejoinRequest(id, body.uid, user.uid);
    return ok(result);
  } catch (e) {
    return fail(e);
  }
}
