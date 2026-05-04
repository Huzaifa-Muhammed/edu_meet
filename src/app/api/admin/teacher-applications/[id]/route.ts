export const dynamic = "force-dynamic";
import "server-only";
import type { NextRequest } from "next/server";
import { verifyToken } from "@/server/auth/verify-token";
import { requireRole } from "@/server/auth/require-role";
import { teacherApplicationsService } from "@/server/services/teacher-applications.service";
import { TeacherApplicationReviewSchema } from "@/shared/schemas/teacher-application.schema";
import { ok, fail } from "@/server/utils/response";

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await verifyToken(req);
    requireRole(auth, ["admin"]);
    const { id } = await ctx.params;
    const body = TeacherApplicationReviewSchema.parse(await req.json());
    const result = await teacherApplicationsService.review(id, auth.uid, body);
    return ok(result);
  } catch (e) {
    return fail(e);
  }
}
