export const dynamic = "force-dynamic";
import "server-only";
import { NextRequest } from "next/server";
import { verifyToken } from "@/server/auth/verify-token";
import { requireRole } from "@/server/auth/require-role";
import { AssessmentSubmitSchema } from "@/shared/schemas/assessment.schema";
import { assessmentsService } from "@/server/services/assessments.service";
import { ok, fail } from "@/server/utils/response";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await verifyToken(req);
    requireRole(user, ["student"]);
    const { id } = await params;
    const body = AssessmentSubmitSchema.parse(await req.json());
    const result = await assessmentsService.submit(id, user.uid, body);
    return ok(result, 201);
  } catch (e) {
    return fail(e);
  }
}
