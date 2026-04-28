export const dynamic = "force-dynamic";
import "server-only";
import { NextRequest } from "next/server";
import { z } from "zod";
import { verifyToken } from "@/server/auth/verify-token";
import { requireRole } from "@/server/auth/require-role";
import { agendaService } from "@/server/services/agenda.service";
import { ok, fail } from "@/server/utils/response";

const PatchSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  description: z.string().max(500).optional(),
  durationMin: z.number().int().min(1).max(300).optional(),
  done: z.boolean().optional(),
  order: z.number().int().min(0).optional(),
});

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; itemId: string }> },
) {
  try {
    const user = await verifyToken(req);
    requireRole(user, ["teacher", "admin"]);
    const { id, itemId } = await ctx.params;
    const body = PatchSchema.parse(await req.json());
    const updated = await agendaService.update(id, itemId, body);
    return ok(updated);
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; itemId: string }> },
) {
  try {
    const user = await verifyToken(req);
    requireRole(user, ["teacher", "admin"]);
    const { id, itemId } = await ctx.params;
    await agendaService.remove(id, itemId);
    return ok({ removed: true });
  } catch (e) {
    return fail(e);
  }
}
