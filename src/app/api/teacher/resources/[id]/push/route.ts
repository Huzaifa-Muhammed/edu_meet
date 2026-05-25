export const dynamic = "force-dynamic";
import "server-only";
import { NextRequest } from "next/server";
import { z } from "zod";
import { verifyToken } from "@/server/auth/verify-token";
import { requireRole } from "@/server/auth/require-role";
import { teacherResourcesService } from "@/server/services/teacher-resources.service";
import { ok, fail } from "@/server/utils/response";

const Schema = z.object({ classroomId: z.string().min(1) });

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await verifyToken(req);
    requireRole(user, ["teacher"]);
    const { id } = await params;
    const { classroomId } = Schema.parse(await req.json());
    const result = await teacherResourcesService.pushToClassroom(
      user.uid,
      id,
      classroomId,
    );
    return ok(result, 201);
  } catch (e) {
    return fail(e);
  }
}
