export const dynamic = "force-dynamic";
import "server-only";
import { NextRequest } from "next/server";
import { z } from "zod";
import { verifyToken } from "@/server/auth/verify-token";
import { requireRole } from "@/server/auth/require-role";
import { resourcesService } from "@/server/services/resources.service";
import { ok, fail } from "@/server/utils/response";

const AddSchema = z.object({
  kind: z.enum(["link", "doc"]).default("link"),
  title: z.string().min(1).max(160),
  url: z.string().url(),
  description: z.string().max(500).optional(),
});

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    await verifyToken(req);
    const { id } = await ctx.params;
    const items = await resourcesService.list(id);
    return ok(items);
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
    requireRole(user, ["teacher", "admin"]);
    const { id } = await ctx.params;
    const body = AddSchema.parse(await req.json());
    const item = await resourcesService.add({ classroomId: id, ...body });
    return ok(item, 201);
  } catch (e) {
    return fail(e);
  }
}
