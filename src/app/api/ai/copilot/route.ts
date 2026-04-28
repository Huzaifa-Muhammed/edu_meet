export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import "server-only";
import { NextRequest } from "next/server";
import { z } from "zod";
import { verifyToken } from "@/server/auth/verify-token";
import { requireRole } from "@/server/auth/require-role";
import { groqProvider, type ChatMessage } from "@/server/providers/ai/groq";
import { fail } from "@/server/utils/response";

const BodySchema = z.object({
  prompt: z.string().min(1),
  context: z
    .object({
      subject: z.string().optional(),
      grade: z.number().optional(),
      topic: z.string().optional(),
      classroomName: z.string().optional(),
      liveQuestion: z.string().optional(),
    })
    .optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await verifyToken(req);
    requireRole(user, ["teacher"]);
    const { prompt, context } = BodySchema.parse(await req.json());

    const ctx = context
      ? `Class context: ${context.classroomName ?? ""} | Subject: ${context.subject ?? ""} | Grade: ${
          context.grade ?? ""
        } | Topic: ${context.topic ?? ""}${
          context.liveQuestion ? ` | A student just asked: "${context.liveQuestion}"` : ""
        }`
      : "";

    const messages: ChatMessage[] = [
      {
        role: "system",
        content:
          "You are VirtualClass Copilot. Reply with a short, actionable suggestion (<120 words) a teacher can use immediately.",
      },
      { role: "user", content: ctx ? `${ctx}\n\n${prompt}` : prompt },
    ];

    const text = await groqProvider.chat(messages, { temperature: 0.6 });
    return Response.json({ ok: true, data: { text } });
  } catch (e) {
    return fail(e);
  }
}
