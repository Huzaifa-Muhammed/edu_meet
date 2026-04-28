export const dynamic = "force-dynamic";
import "server-only";
import { NextRequest } from "next/server";
import { z } from "zod";
import { verifyToken } from "@/server/auth/verify-token";
import { requireRole } from "@/server/auth/require-role";
import { agendaService } from "@/server/services/agenda.service";
import { ok, fail } from "@/server/utils/response";

const AddSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  durationMin: z.number().int().min(1).max(300).optional(),
});

/** GET — list agenda items for a classroom. Any authed user. */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    await verifyToken(req);
    const { id } = await ctx.params;
    const items = await agendaService.list(id);
    return ok(items);
  } catch (e) {
    return fail(e);
  }
}

/** POST — add a new agenda item. Teacher/admin only. */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const user = await verifyToken(req);
    requireRole(user, ["teacher", "admin"]);
    const { id } = await ctx.params;
    const body = AddSchema.parse(await req.json());
    const item = await agendaService.add({ classroomId: id, ...body });
    return ok(item, 201);
  } catch (e) {
    return fail(e);
  }
}
