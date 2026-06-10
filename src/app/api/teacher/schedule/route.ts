export const dynamic = "force-dynamic";
import "server-only";
import { NextRequest } from "next/server";
import { verifyToken } from "@/server/auth/verify-token";
import { requireRole } from "@/server/auth/require-role";
import { scheduleService } from "@/server/services/schedule.service";
import { leaveService } from "@/server/services/leave.service";
import { ok, fail } from "@/server/utils/response";
import { badRequest } from "@/server/utils/errors";

/** Parse a "YYYY-MM" param into { year, monthIdx0 }; defaults to current month. */
function parseMonth(value: string | null): { year: number; monthIdx0: number } {
  if (value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value)) {
    const [y, m] = value.split("-").map(Number);
    return { year: y, monthIdx0: m - 1 };
  }
  if (value) throw badRequest("Invalid month — expected YYYY-MM");
  const now = new Date();
  return { year: now.getUTCFullYear(), monthIdx0: now.getUTCMonth() };
}

export async function GET(req: NextRequest) {
  try {
    const user = await verifyToken(req);
    requireRole(user, ["teacher"]);
    const { year, monthIdx0 } = parseMonth(
      req.nextUrl.searchParams.get("month"),
    );

    // Lazily ensure the soonest empty upcoming week has an AI proposal waiting.
    await scheduleService.autoProposeIfNeeded(user.uid).catch((e) => {
      console.warn("[schedule] auto-propose failed:", e);
    });

    const monthPrefix = `${year}-${String(monthIdx0 + 1).padStart(2, "0")}`;
    const [meetings, availability, pendingProposal, leaveSet] = await Promise.all([
      scheduleService.listMonth(user.uid, year, monthIdx0),
      scheduleService.getAvailability(user.uid),
      scheduleService.getPendingProposal(user.uid),
      leaveService.approvedLeaveDates(user.uid, monthPrefix),
    ]);
    return ok({
      month: monthPrefix,
      meetings,
      availability,
      pendingProposal,
      leaveDates: Array.from(leaveSet),
    });
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await verifyToken(req);
    requireRole(user, ["teacher"]);
    const { year, monthIdx0 } = parseMonth(
      req.nextUrl.searchParams.get("month"),
    );
    const cleared = await scheduleService.clearMonth(user.uid, year, monthIdx0);
    return ok({ cleared });
  } catch (e) {
    return fail(e);
  }
}
