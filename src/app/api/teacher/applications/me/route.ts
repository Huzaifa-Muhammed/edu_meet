export const dynamic = "force-dynamic";
import "server-only";
import type { NextRequest } from "next/server";
import { verifyToken } from "@/server/auth/verify-token";
import { requireRole } from "@/server/auth/require-role";
import { teacherApplicationsService } from "@/server/services/teacher-applications.service";
import { TeacherApplicationCreateSchema } from "@/shared/schemas/teacher-application.schema";
import { ok, fail } from "@/server/utils/response";

export async function GET(req: NextRequest) {
  try {
    const auth = await verifyToken(req);
    requireRole(auth, ["teacher"]);
    const app = await teacherApplicationsService.getByUid(auth.uid);
    return ok({ application: app });
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyToken(req);
    requireRole(auth, ["teacher"]);
    const body = TeacherApplicationCreateSchema.parse(await req.json());
    const result = await teacherApplicationsService.submit(
      auth.uid,
      auth.email,
      auth.displayName,
      body,
    );
    return ok(result, 201);
  } catch (e) {
    return fail(e);
  }
}
