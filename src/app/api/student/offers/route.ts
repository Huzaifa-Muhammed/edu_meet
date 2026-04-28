export const dynamic = "force-dynamic";
import "server-only";
import { NextRequest } from "next/server";
import { verifyToken } from "@/server/auth/verify-token";
import { requireRole } from "@/server/auth/require-role";
import { offersService } from "@/server/services/offers.service";
import { brainTokensService } from "@/server/services/brain-tokens.service";
import { ok, fail } from "@/server/utils/response";

export async function GET(req: NextRequest) {
  try {
    const user = await verifyToken(req);
    requireRole(user, ["student"]);
    const [offers, redemptions, tokens] = await Promise.all([
      offersService.list(),
      offersService.listRedemptions(user.uid),
      brainTokensService.get(user.uid),
    ]);
    return ok({ offers, redemptions, balance: tokens.balance });
  } catch (e) {
    return fail(e);
  }
}
