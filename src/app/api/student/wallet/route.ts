export const dynamic = "force-dynamic";
import "server-only";
import { NextRequest } from "next/server";
import { verifyToken } from "@/server/auth/verify-token";
import { requireRole } from "@/server/auth/require-role";
import { brainTokensService } from "@/server/services/brain-tokens.service";
import { ok, fail } from "@/server/utils/response";

export async function GET(req: NextRequest) {
  try {
    const user = await verifyToken(req);
    requireRole(user, ["student"]);
    const [tokens, transactions, histogram] = await Promise.all([
      brainTokensService.get(user.uid),
      brainTokensService.listTransactions(user.uid, 20),
      brainTokensService.dailyHistogram(user.uid, 13),
    ]);
    return ok({ tokens, transactions, histogram });
  } catch (e) {
    return fail(e);
  }
}
