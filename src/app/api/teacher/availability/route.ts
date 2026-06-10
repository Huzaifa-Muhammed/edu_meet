export const dynamic = "force-dynamic";
import "server-only";
import { NextRequest } from "next/server";
import { verifyToken } from "@/server/auth/verify-token";
import { requireRole } from "@/server/auth/require-role";
import { scheduleService } from "@/server/services/schedule.service";
import { AvailabilitySaveSchema } from "@/shared/schemas/schedule.schema";
import { ok, fail } from "@/server/utils/response";

export async function GET(req: NextRequest) {
  try {
    const user = await verifyToken(req);
    requireRole(user, ["teacher"]);
    const data = await scheduleService.getAvailability(user.uid);
    return ok(data);
  } catch (e) {
    return fail(e);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await verifyToken(req);
    requireRole(user, ["teacher"]);
    const input = AvailabilitySaveSchema.parse(await req.json());
    const data = await scheduleService.saveAvailability(user.uid, input);
    return ok(data);
  } catch (e) {
    return fail(e);
  }
}
