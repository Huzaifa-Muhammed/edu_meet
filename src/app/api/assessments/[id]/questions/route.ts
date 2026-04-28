export const dynamic = "force-dynamic";
import "server-only";
import { NextRequest } from "next/server";
import { verifyToken } from "@/server/auth/verify-token";
import { requireRole } from "@/server/auth/require-role";
import { AssessmentQuestionSchema } from "@/shared/schemas/assessment.schema";
import { assessmentsService } from "@/server/services/assessments.service";
import { ok, fail } from "@/server/utils/response";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await verifyToken(req);
    const { id } = await params;
    const questions = await assessmentsService.getQuestions(id);
    return ok(questions);
  } catch (e) {
    return fail(e);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await verifyToken(req);
    requireRole(user, ["teacher"]);
    const { id } = await params;
    const body = AssessmentQuestionSchema.parse(await req.json());
    const question = await assessmentsService.addQuestion(id, body);
    return ok(question, 201);
  } catch (e) {
    return fail(e);
  }
}
