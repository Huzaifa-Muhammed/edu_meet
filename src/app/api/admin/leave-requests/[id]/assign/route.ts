export const dynamic = "force-dynamic";
import "server-only";
import { NextRequest } from "next/server";
import { z } from "zod";
import { verifyToken } from "@/server/auth/verify-token";
import { requireRole } from "@/server/auth/require-role";
import { meetingsService } from "@/server/services/meetings.service";
import { ok, fail } from "@/server/utils/response";

const BodySchema = z.object({
  meetingId: z.string().min(1),
  teacherId: z.string().min(1),
});

/** Admin assigns a substitute teacher to cover one class during a leave. */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await verifyToken(req);
    requireRole(auth, ["admin"]);
    await ctx.params; // leave id is contextual; reassignment is per-meeting
    const { meetingId, teacherId } = BodySchema.parse(await req.json());
    const result = await meetingsService.reassignTeacher(meetingId, teacherId, auth.uid);
    return ok(result);
  } catch (e) {
    return fail(e);
  }
}
