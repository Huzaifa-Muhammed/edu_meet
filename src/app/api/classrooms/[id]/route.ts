export const dynamic = "force-dynamic";
import "server-only";
import { NextRequest } from "next/server";
import { verifyToken } from "@/server/auth/verify-token";
import { ClassroomUpdateSchema } from "@/shared/schemas/classroom.schema";
import { classroomsService } from "@/server/services/classrooms.service";
import { ok, fail } from "@/server/utils/response";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await verifyToken(req);
    const { id } = await params;
    const classroom = await classroomsService.getById(id);
    return ok(classroom);
  } catch (e) {
    return fail(e);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await verifyToken(req);
    const { id } = await params;
    const body = ClassroomUpdateSchema.parse(await req.json());
    const updated = await classroomsService.update(id, body);
    return ok(updated);
  } catch (e) {
    return fail(e);
  }
}
