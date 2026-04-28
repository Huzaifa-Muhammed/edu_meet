export const dynamic = "force-dynamic";
import "server-only";
import { NextRequest } from "next/server";
import { z } from "zod";
import { verifyToken } from "@/server/auth/verify-token";
import { requireRole } from "@/server/auth/require-role";
import { brainTokensService } from "@/server/services/brain-tokens.service";
import { ok, fail } from "@/server/utils/response";

const VALID_GAMES = ["scramble", "memory", "sprint", "sequence"] as const;
const PER_CLAIM_MAX = 10;
const DAILY_CAP = 30;

const ClaimSchema = z.object({
  game: z.enum(VALID_GAMES),
  count: z.number().int().min(1).max(PER_CLAIM_MAX),
  meetingId: z.string().optional(),
  classroomId: z.string().optional(),
});

const GAME_TITLES: Record<(typeof VALID_GAMES)[number], string> = {
  scramble: "Word Scramble win",
  memory: "Memory Match win",
  sprint: "Math Sprint win",
  sequence: "Number Sequence win",
};

/** Student claims BT earned from gaming-room placeholder games. 1 BT per
 *  successful round, capped at 10 per claim and 30 per day total. */
export async function POST(req: NextRequest) {
  try {
    const user = await verifyToken(req);
    requireRole(user, ["student"]);
    const body = ClaimSchema.parse(await req.json());

    const earnedToday = await brainTokensService.todayEarnedByReason(
      user.uid,
      "game_reward",
    );
    const remaining = Math.max(0, DAILY_CAP - earnedToday);
    if (remaining === 0) {
      return ok({
        claimed: 0,
        newBalance: (await brainTokensService.get(user.uid)).balance,
        dailyCap: DAILY_CAP,
        capped: true,
      });
    }

    const claimed = Math.min(body.count, remaining);
    const result = await brainTokensService.credit(user.uid, claimed, {
      reason: "game_reward",
      title: GAME_TITLES[body.game],
      source: "Gaming Room",
      meetingId: body.meetingId,
      classroomId: body.classroomId,
    });

    return ok({
      claimed,
      newBalance: result.newBalance,
      dailyCap: DAILY_CAP,
      capped: claimed < body.count,
    });
  } catch (e) {
    return fail(e);
  }
}
