export const dynamic = "force-dynamic";
import "server-only";
import { NextRequest } from "next/server";
import { z } from "zod";
import { verifyToken } from "@/server/auth/verify-token";
import { classQuestionsService } from "@/server/services/class-questions.service";
import { ok, fail } from "@/server/utils/response";
import { badRequest } from "@/server/utils/errors";

const QuestionSchema = z.object({
  text: z.string().min(1).max(1500),
  meetingId: z.string().optional(),
});

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    await verifyToken(req);
    const { id } = await ctx.params;
    const list = await classQuestionsService.list(id);
    return ok(list);
  } catch (e) {
    return fail(e);
  }
}

/** Any enrolled user can ask a question. Teacher/admin can also ask. */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const user = await verifyToken(req);
    const { id } = await ctx.params;

    const body = await req.json().catch(() => ({}));
    const parsed = QuestionSchema.safeParse(body);
    if (!parsed.success) throw badRequest("Invalid question body");

    const q = await classQuestionsService.add({
      classroomId: id,
      meetingId: parsed.data.meetingId ?? null,
      text: parsed.data.text,
      askedById: user.uid,
      askedByName: user.displayName ?? user.email ?? "Student",
    });
    return ok(q);
  } catch (e) {
    return fail(e);
  }
}
