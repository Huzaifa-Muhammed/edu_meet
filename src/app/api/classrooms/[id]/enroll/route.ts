export const dynamic = "force-dynamic";
import "server-only";
import { NextRequest } from "next/server";
import { verifyToken } from "@/server/auth/verify-token";
import { requireRole } from "@/server/auth/require-role";
import { EnrollSchema } from "@/shared/schemas/classroom.schema";
import { classroomsService } from "@/server/services/classrooms.service";
import { ok, fail } from "@/server/utils/response";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await verifyToken(req);
    requireRole(user, ["student"]);
    const { id } = await params;
    const body = EnrollSchema.parse(await req.json());
    const result = await classroomsService.enroll(id, user.uid, body.code);
    return ok(result);
  } catch (e) {
    return fail(e);
  }
}
