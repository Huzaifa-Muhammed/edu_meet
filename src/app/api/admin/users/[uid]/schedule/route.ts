export const dynamic = "force-dynamic";
import "server-only";
import { NextRequest } from "next/server";
import { verifyToken } from "@/server/auth/verify-token";
import { requireRole } from "@/server/auth/require-role";
import { scheduleService } from "@/server/services/schedule.service";
import { leaveService } from "@/server/services/leave.service";
import { ok, fail } from "@/server/utils/response";
import { badRequest } from "@/server/utils/errors";

function parseMonth(value: string | null): { year: number; monthIdx0: number } {
  if (value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value)) {
    const [y, m] = value.split("-").map(Number);
    return { year: y, monthIdx0: m - 1 };
  }
  if (value) throw badRequest("Invalid month — expected YYYY-MM");
  const now = new Date();
  return { year: now.getUTCFullYear(), monthIdx0: now.getUTCMonth() };
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ uid: string }> },
) {
  try {
    const auth = await verifyToken(req);
    requireRole(auth, ["admin"]);
    const { uid } = await ctx.params;
    const { year, monthIdx0 } = parseMonth(
      req.nextUrl.searchParams.get("month"),
    );
    const monthPrefix = `${year}-${String(monthIdx0 + 1).padStart(2, "0")}`;
    const [allMeetings, availability, leaveSet] = await Promise.all([
      scheduleService.listMonth(uid, year, monthIdx0),
      scheduleService.getAvailability(uid),
      leaveService.approvedLeaveDates(uid, monthPrefix),
    ]);
    // Admin sees the published schedule (what students see), not unapproved
    // AI proposals.
    const meetings = allMeetings.filter((m) => m.scheduleStatus !== "proposed");
    return ok({
      month: monthPrefix,
      meetings,
      availability,
      leaveDates: Array.from(leaveSet),
    });
  } catch (e) {
    return fail(e);
  }
}
