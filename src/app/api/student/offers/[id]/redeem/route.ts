export const dynamic = "force-dynamic";
import "server-only";
import { NextRequest } from "next/server";
import { verifyToken } from "@/server/auth/verify-token";
import { requireRole } from "@/server/auth/require-role";
import { offersService } from "@/server/services/offers.service";
import { ok, fail } from "@/server/utils/response";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await verifyToken(req);
    requireRole(user, ["student"]);
    const { id } = await params;
    const redemption = await offersService.redeem(user.uid, id);
    return ok(redemption, 201);
  } catch (e) {
    return fail(e);
  }
}
