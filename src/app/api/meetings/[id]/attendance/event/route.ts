export const dynamic = "force-dynamic";
import "server-only";
import { NextRequest } from "next/server";
import { z } from "zod";
import { verifyToken } from "@/server/auth/verify-token";
import { meetingsService } from "@/server/services/meetings.service";
import { ok, fail } from "@/server/utils/response";

const AttendanceSchema = z.object({
  type: z.enum(["join", "leave", "hand", "mic", "away", "attentive"]),
});

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const user = await verifyToken(req);
    const { id } = await ctx.params;
    const { type } = AttendanceSchema.parse(await req.json());
    await meetingsService.logAttendance(id, user.uid, type);
    return ok({ logged: true });
  } catch (e) {
    return fail(e);
  }
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    await verifyToken(req);
    const { id } = await ctx.params;
    const events = await meetingsService.getAttendance(id);
    return ok(events);
  } catch (e) {
    return fail(e);
  }
}
