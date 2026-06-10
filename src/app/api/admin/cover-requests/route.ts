export const dynamic = "force-dynamic";
import "server-only";
import { NextRequest } from "next/server";
import { verifyToken } from "@/server/auth/verify-token";
import { requireRole } from "@/server/auth/require-role";
import { coverService } from "@/server/services/cover.service";
import { ok, fail } from "@/server/utils/response";

const STATUSES = ["open", "assigned", "contested", "cancelled"] as const;
type Status = (typeof STATUSES)[number];

/** Admin list of cover requests (defaults to all non-cancelled).
 *  `?status=contested` surfaces the ones needing an admin decision. */
export async function GET(req: NextRequest) {
  try {
    const auth = await verifyToken(req);
    requireRole(auth, ["admin"]);
    const raw = req.nextUrl.searchParams.get("status");
    const status = STATUSES.includes(raw as Status) ? (raw as Status) : undefined;
    const items = await coverService.listForAdmin(status);
    return ok(items);
  } catch (e) {
    return fail(e);
  }
}
