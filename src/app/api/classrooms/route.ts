export const dynamic = "force-dynamic";
import "server-only";
import { NextRequest } from "next/server";
import { verifyToken } from "@/server/auth/verify-token";
import { requireRole } from "@/server/auth/require-role";
import { ClassroomCreateSchema } from "@/shared/schemas/classroom.schema";
import { classroomsService } from "@/server/services/classrooms.service";
import { ok, fail } from "@/server/utils/response";

export async function GET(req: NextRequest) {
  try {
    const user = await verifyToken(req);
    const classrooms = await classroomsService.list(user.role, user.uid);
    return ok(classrooms);
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await verifyToken(req);
    requireRole(user, ["teacher"]);
    const body = ClassroomCreateSchema.parse(await req.json());
    const classroom = await classroomsService.create(user.uid, body);
    return ok(classroom, 201);
  } catch (e) {
    return fail(e);
  }
}
