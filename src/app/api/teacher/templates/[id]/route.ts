export const dynamic = "force-dynamic";
import "server-only";
import { NextRequest } from "next/server";
import { z } from "zod";
import { verifyToken } from "@/server/auth/verify-token";
import { requireRole } from "@/server/auth/require-role";
import { lessonTemplatesService } from "@/server/services/lesson-templates.service";
import { ok, fail } from "@/server/utils/response";

const PatchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  subject: z.string().max(60).optional(),
  items: z
    .array(
      z.object({
        title: z.string().min(1).max(120),
        description: z.string().max(500).optional(),
        durationMin: z.number().int().min(0).max(600).optional(),
      }),
    )
    .min(1)
    .max(30)
    .optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await verifyToken(req);
    requireRole(user, ["teacher"]);
    const { id } = await params;
    const body = PatchSchema.parse(await req.json());
    const item = await lessonTemplatesService.update(user.uid, id, body);
    return ok(item);
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
    await lessonTemplatesService.remove(user.uid, id);
    return ok({ removed: true });
  } catch (e) {
    return fail(e);
  }
}
