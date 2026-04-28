export const dynamic = "force-dynamic";
import "server-only";
import { NextRequest } from "next/server";
import { z } from "zod";
import { verifyToken } from "@/server/auth/verify-token";
import { requireRole } from "@/server/auth/require-role";
import { brainTokensService } from "@/server/services/brain-tokens.service";
import { ok, fail } from "@/server/utils/response";

const Body = z.object({
  studentUid: z.string().min(1),
  pts: z.number().int().min(1).max(100),
  label: z.string().min(1).max(80),
  emoji: z.string().max(8).optional(),
  note: z.string().max(280).optional(),
  meetingId: z.string().optional(),
});

/**
 * Teacher awards a reward to a student. Server credits BT + writes ledger
 * entry; the client still broadcasts REWARD pubsub for the confetti UX.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await verifyToken(req);
    requireRole(user, ["teacher", "admin"]);
    const { id: classroomId } = await params;
    const body = Body.parse(await req.json());

    const result = await brainTokensService.credit(body.studentUid, body.pts, {
      reason: "teacher_reward",
      title: body.note
        ? `${body.label} — ${body.note}`
        : `${body.label} reward`,
      source: body.emoji ? `${body.emoji} ${body.label}` : body.label,
      classroomId,
      meetingId: body.meetingId,
      actorUid: user.uid,
    });

    return ok(result, 201);
  } catch (e) {
    return fail(e);
  }
}
