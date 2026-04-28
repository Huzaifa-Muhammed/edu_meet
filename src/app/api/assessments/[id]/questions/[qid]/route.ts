export const dynamic = "force-dynamic";
import "server-only";
import { NextRequest } from "next/server";
import { verifyToken } from "@/server/auth/verify-token";
import { requireRole } from "@/server/auth/require-role";
import { AssessmentQuestionSchema } from "@/shared/schemas/assessment.schema";
import { assessmentsService } from "@/server/services/assessments.service";
import { ok, fail } from "@/server/utils/response";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; qid: string }> },
) {
  try {
    const user = await verifyToken(req);
    requireRole(user, ["teacher"]);
    const { id, qid } = await params;
    const body = AssessmentQuestionSchema.partial().parse(await req.json());
    const updated = await assessmentsService.updateQuestion(id, qid, body);
    return ok(updated);
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; qid: string }> },
) {
  try {
    const user = await verifyToken(req);
    requireRole(user, ["teacher"]);
    const { id, qid } = await params;
    await assessmentsService.deleteQuestion(id, qid);
    return ok({ deleted: true });
  } catch (e) {
    return fail(e);
  }
}
