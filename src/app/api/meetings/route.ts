export const dynamic = "force-dynamic";
import "server-only";
import { NextRequest } from "next/server";
import { verifyToken } from "@/server/auth/verify-token";
import { requireRole } from "@/server/auth/require-role";
import { MeetingCreateSchema } from "@/shared/schemas/meeting.schema";
import { meetingsService } from "@/server/services/meetings.service";
import { ok, fail } from "@/server/utils/response";

export async function POST(req: NextRequest) {
  try {
    const user = await verifyToken(req);
    requireRole(user, ["teacher"]);
    const body = MeetingCreateSchema.parse(await req.json());
    const meeting = await meetingsService.create(user.uid, body);
    return ok(meeting, 201);
  } catch (e) {
    return fail(e);
  }
}
