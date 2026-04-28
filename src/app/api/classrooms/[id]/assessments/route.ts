export const dynamic = "force-dynamic";
import "server-only";
import { NextRequest } from "next/server";
import { z } from "zod";
import { verifyToken } from "@/server/auth/verify-token";
import { requireRole } from "@/server/auth/require-role";
import { assessmentsService } from "@/server/services/assessments.service";
import { classroomsService } from "@/server/services/classrooms.service";
import {
  AssessmentQuestionSchema,
} from "@/shared/schemas/assessment.schema";
import { ok, fail } from "@/server/utils/response";
import { forbidden } from "@/server/utils/errors";

const CreateWithQuestionsSchema = z.object({
  title: z.string().min(1).max(200),
  instructions: z.string().max(2000).optional(),
  dueAt: z.string().optional(),
  assign: z.boolean().optional(),
  questions: z.array(AssessmentQuestionSchema).min(1),
});

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    await verifyToken(req);
    const { id } = await ctx.params;
    const list = await assessmentsService.list(id);
    return ok(list);
  } catch (e) {
    return fail(e);
  }
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const user = await verifyToken(req);
    requireRole(user, ["teacher"]);
    const { id: classroomId } = await ctx.params;

    const classroom = (await classroomsService.getById(classroomId)) as unknown as {
      teacherId: string;
    };
    if (classroom.teacherId !== user.uid) throw forbidden("Not your classroom");

    const body = CreateWithQuestionsSchema.parse(await req.json());

    const totalPoints = body.questions.reduce((s, q) => s + q.points, 0);

    const assessment = await assessmentsService.create(user.uid, {
      classroomId,
      title: body.title,
      instructions: body.instructions,
      dueAt: body.dueAt,
      totalPoints,
    });

    for (const q of body.questions) {
      await assessmentsService.addQuestion(assessment.id, q);
    }

    if (body.assign !== false) {
      await assessmentsService.assign(assessment.id);
    }

    return ok({ ...assessment, totalPoints, questionsCount: body.questions.length }, 201);
  } catch (e) {
    return fail(e);
  }
}
