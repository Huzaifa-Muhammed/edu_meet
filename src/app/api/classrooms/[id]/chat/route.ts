export const dynamic = "force-dynamic";
import "server-only";
import { NextRequest } from "next/server";
import { z } from "zod";
import { verifyToken } from "@/server/auth/verify-token";
import { classChatService } from "@/server/services/class-chat.service";
import { ok, fail } from "@/server/utils/response";
import { badRequest } from "@/server/utils/errors";

const MsgSchema = z.object({
  text: z.string().min(1).max(2000),
  meetingId: z.string().optional(),
  clientId: z.string().min(1).max(64).optional(),
});

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    await verifyToken(req);
    const { id } = await ctx.params;
    const list = await classChatService.list(id);
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
    const { id } = await ctx.params;

    const body = await req.json().catch(() => ({}));
    const parsed = MsgSchema.safeParse(body);
    if (!parsed.success) throw badRequest("Invalid message body");

    const msg = await classChatService.add({
      classroomId: id,
      meetingId: parsed.data.meetingId ?? null,
      text: parsed.data.text,
      clientId: parsed.data.clientId,
      senderId: user.uid,
      senderName: user.displayName ?? user.email ?? "User",
      senderRole:
        user.role === "teacher" ? "teacher" : user.role === "admin" ? "admin" : "student",
    });
    return ok(msg);
  } catch (e) {
    return fail(e);
  }
}
