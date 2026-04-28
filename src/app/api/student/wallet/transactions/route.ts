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
    const url = new URL(req.url);
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 100), 200);
    const items = await brainTokensService.listTransactions(user.uid, limit);
    return ok(items);
  } catch (e) {
    return fail(e);
  }
}
