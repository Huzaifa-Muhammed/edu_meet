export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import "server-only";
import { NextRequest } from "next/server";
import { verifyToken } from "@/server/auth/verify-token";
import { requireRole } from "@/server/auth/require-role";
import { scheduleService } from "@/server/services/schedule.service";
import { ScheduleGenerateSchema } from "@/shared/schemas/schedule.schema";
import { ok, fail } from "@/server/utils/response";

export async function POST(req: NextRequest) {
  try {
    const user = await verifyToken(req);
    requireRole(user, ["teacher"]);
    const body = await req.json().catch(() => ({}));
    const { weekStart, sessionsPerWeek } = ScheduleGenerateSchema.parse(body ?? {});
    const result = await scheduleService.generate(user.uid, { weekStart, sessionsPerWeek });
    return ok(result);
  } catch (e) {
    return fail(e);
  }
}
