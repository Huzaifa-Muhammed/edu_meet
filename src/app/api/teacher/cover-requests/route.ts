export const dynamic = "force-dynamic";
import "server-only";
import { NextRequest } from "next/server";
import { verifyToken } from "@/server/auth/verify-token";
import { requireRole } from "@/server/auth/require-role";
import { coverService } from "@/server/services/cover.service";
import { ok, fail } from "@/server/utils/response";

/** Cover requests relevant to the signed-in teacher (open same-subject ones
 *  they can grab + any they've accepted / won / lost). */
export async function GET(req: NextRequest) {
  try {
    const user = await verifyToken(req);
    requireRole(user, ["teacher"]);
    const items = await coverService.listForTeacher(user.uid);
    return ok(items);
  } catch (e) {
    return fail(e);
  }
}
