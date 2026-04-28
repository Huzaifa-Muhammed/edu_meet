export const dynamic = "force-dynamic";
import "server-only";
import { NextRequest } from "next/server";
import { verifyToken } from "@/server/auth/verify-token";
import { requireRole } from "@/server/auth/require-role";
import { AssessmentCreateSchema } from "@/shared/schemas/assessment.schema";
import { assessmentsService } from "@/server/services/assessments.service";
import { ok, fail } from "@/server/utils/response";

export async function GET(req: NextRequest) {
  try {
    const user = await verifyToken(req);
    const url = new URL(req.url);
    const classroomId = url.searchParams.get("classroomId") ?? undefined;

    const assessments =
      user.role === "teacher"
        ? await assessmentsService.list(classroomId, user.uid)
        : await assessmentsService.list(classroomId);

    return ok(assessments);
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await verifyToken(req);
    requireRole(user, ["teacher"]);
    const body = AssessmentCreateSchema.parse(await req.json());
    const assessment = await assessmentsService.create(user.uid, body);
    return ok(assessment, 201);
  } catch (e) {
    return fail(e);
  }
}
