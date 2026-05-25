export const dynamic = "force-dynamic";
import "server-only";
import { NextRequest } from "next/server";
import { z } from "zod";
import { verifyToken } from "@/server/auth/verify-token";
import { requireRole } from "@/server/auth/require-role";
import { lessonTemplatesService } from "@/server/services/lesson-templates.service";
import { ok, fail } from "@/server/utils/response";

const ItemSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  durationMin: z.number().int().min(0).max(600).optional(),
});

const CreateSchema = z.object({
  name: z.string().min(1).max(120),
  subject: z.string().max(60).optional(),
  items: z.array(ItemSchema).min(1).max(30),
});

export async function GET(req: NextRequest) {
  try {
    const user = await verifyToken(req);
    requireRole(user, ["teacher"]);
    const items = await lessonTemplatesService.list(user.uid);
    return ok(items);
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await verifyToken(req);
    requireRole(user, ["teacher"]);
    const body = CreateSchema.parse(await req.json());
    const item = await lessonTemplatesService.create(user.uid, body);
    return ok(item, 201);
  } catch (e) {
    return fail(e);
  }
}
