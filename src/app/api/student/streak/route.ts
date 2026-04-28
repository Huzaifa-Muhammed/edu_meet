export const dynamic = "force-dynamic";
import "server-only";
import { NextRequest } from "next/server";
import { verifyToken } from "@/server/auth/verify-token";
import { requireRole } from "@/server/auth/require-role";
import { brainTokensService } from "@/server/services/brain-tokens.service";
import { ok, fail } from "@/server/utils/response";

/** Ping the streak tracker — idempotent per day. Called on dashboard mount. */
export async function POST(req: NextRequest) {
  try {
    const user = await verifyToken(req);
    requireRole(user, ["student"]);
    const result = await brainTokensService.checkStreak(user.uid);
    return ok(result);
  } catch (e) {
    return fail(e);
  }
}
