export const dynamic = "force-dynamic";
import "server-only";
import { NextRequest } from "next/server";
import { z } from "zod";
import { verifyToken } from "@/server/auth/verify-token";
import { meetingsService } from "@/server/services/meetings.service";
import { ok, fail } from "@/server/utils/response";
import { badRequest } from "@/server/utils/errors";

const Body = z.object({
  uid: z.string().min(1),
  /** Set to false to readmit a previously-kicked student. */
  banned: z.boolean().optional().default(true),
});

/** Teacher-only: ban / unban a student from this meeting. The token
 *  endpoint refuses banned uids on the next join attempt. The teacher
 *  client also publishes STUDENT_KICK so any active session is signalled
 *  to leave immediately. */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const user = await verifyToken(req);
    const { id } = await ctx.params;
    const body = Body.parse(await req.json());
    if (body.uid === user.uid) throw badRequest("You can't remove yourself");
    const result = body.banned
      ? await meetingsService.kickStudent(id, body.uid, user.uid)
      : await meetingsService.unkickStudent(id, body.uid, user.uid);
    return ok(result);
  } catch (e) {
    return fail(e);
  }
}
