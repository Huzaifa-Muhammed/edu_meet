export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import "server-only";
import { NextRequest } from "next/server";
import { z } from "zod";
import { verifyToken } from "@/server/auth/verify-token";
import { groqProvider, type ChatMessage } from "@/server/providers/ai/groq";
import { fail } from "@/server/utils/response";

const BodySchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["system", "user", "assistant"]),
      content: z.string(),
    }),
  ),
  stream: z.boolean().optional(),
  temperature: z.number().min(0).max(2).optional(),
});

const TEACHER_SYSTEM = `You are VirtualClass Copilot — a teaching assistant helping a teacher during a live class.
You see lesson agenda, student questions and engagement signals.
Be brief, practical, and classroom-aware. Suggest concrete next actions when useful.`;

const STUDENT_SYSTEM = `You are VirtualClass Study Buddy — a friendly tutor for the student's current lesson.
Explain concepts step-by-step, use examples, and ask a check-for-understanding question at the end.`;

export async function POST(req: NextRequest) {
  try {
    const user = await verifyToken(req);
    const body = BodySchema.parse(await req.json());

    const sys: ChatMessage = {
      role: "system",
      content: user.role === "teacher" ? TEACHER_SYSTEM : STUDENT_SYSTEM,
    };
    const messages: ChatMessage[] = [sys, ...body.messages];

    if (body.stream) {
      const stream = await groqProvider.stream(messages, {
        temperature: body.temperature,
      });
      return new Response(stream, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          "X-Accel-Buffering": "no",
        },
      });
    }

    const text = await groqProvider.chat(messages, {
      temperature: body.temperature,
    });
    return Response.json({ ok: true, data: { text } });
  } catch (e) {
    return fail(e);
  }
}
