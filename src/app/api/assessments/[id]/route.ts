export const dynamic = "force-dynamic";
import "server-only";
import { NextRequest } from "next/server";
import { verifyToken } from "@/server/auth/verify-token";
import { requireRole } from "@/server/auth/require-role";
import { AssessmentCreateSchema } from "@/shared/schemas/assessment.schema";
import { assessmentsService } from "@/server/services/assessments.service";
import { ok, fail } from "@/server/utils/response";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await verifyToken(req);
    const { id } = await params;
    const assessment = await assessmentsService.getById(id);
    return ok(assessment);
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
    requireRole(user, ["teacher"]);
    const { id } = await params;
    const body = AssessmentCreateSchema.partial().parse(await req.json());
    const updated = await assessmentsService.update(id, body);
    return ok(updated);
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await verifyToken(req);
    requireRole(user, ["teacher"]);
    const { id } = await params;
    await assessmentsService.remove(id);
    return ok({ deleted: true });
  } catch (e) {
    return fail(e);
  }
}
