export const dynamic = "force-dynamic";
import "server-only";
import { NextRequest } from "next/server";
import { verifyToken } from "@/server/auth/verify-token";
import { meetingsService } from "@/server/services/meetings.service";
import { ok, fail } from "@/server/utils/response";

/** A banned student files (or refreshes) a request to rejoin the meeting.
 *  Idempotent — repeat calls reset the timestamp and put status back to
 *  pending. Returns { status: "pending" | "not-banned" }. */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const user = await verifyToken(req);
    const { id } = await ctx.params;
    const result = await meetingsService.requestRejoin(
      id,
      user.uid,
      user.displayName ?? "Student",
      user.email,
    );
    return ok(result);
  } catch (e) {
    return fail(e);
  }
}

/** Polled by the student-side rejoin screen to check approval state. */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const user = await verifyToken(req);
    const { id } = await ctx.params;
    const doc = await meetingsService.getRejoinRequest(id, user.uid);
    return ok(doc ?? { status: "none" });
  } catch (e) {
    return fail(e);
  }
}
