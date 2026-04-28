export const dynamic = "force-dynamic";
import "server-only";
import { NextRequest } from "next/server";
import { verifyToken } from "@/server/auth/verify-token";
import { requireRole } from "@/server/auth/require-role";
import { assessmentsService } from "@/server/services/assessments.service";
import { ok, fail } from "@/server/utils/response";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await verifyToken(req);
    requireRole(user, ["student"]);
    const { id } = await params;
    const result = await assessmentsService.getStudentResult(id, user.uid);
    return ok(result);
  } catch (e) {
    return fail(e);
  }
}
