export const dynamic = "force-dynamic";
import "server-only";
import { NextRequest } from "next/server";
import { z } from "zod";
import { verifyToken } from "@/server/auth/verify-token";
import { requireRole } from "@/server/auth/require-role";
import { meetingsService } from "@/server/services/meetings.service";
import { ok, fail } from "@/server/utils/response";
import { forbidden } from "@/server/utils/errors";

const SegmentSchema = z.object({
  id: z.string().min(1).max(80),
  text: z.string().min(1).max(2000),
  ts: z.number().int().nonnegative(),
  name: z.string().max(120).optional(),
});

const AppendSchema = z.object({
  // Cap per-flush batch so a misbehaving client can't bloat the doc.
  segments: z.array(SegmentSchema).min(1).max(200),
});

/** Append finalised caption segments to the meeting transcript. Host only —
 *  the teacher's browser is the single recorder of record. */
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

    const { segments } = AppendSchema.parse(await req.json());
    const result = await meetingsService.appendTranscript(id, segments);
    return ok(result);
  } catch (e) {
    return fail(e);
  }
}

/** Read the full transcript. Any authenticated participant gets the same
 *  canonical copy, independent of when they joined. */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    await verifyToken(req);
    const { id } = await ctx.params;
    const transcript = await meetingsService.getTranscript(id);
    return ok(transcript);
  } catch (e) {
    return fail(e);
  }
}
