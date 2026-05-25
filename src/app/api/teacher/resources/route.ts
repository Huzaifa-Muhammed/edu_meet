export const dynamic = "force-dynamic";
import "server-only";
import { NextRequest } from "next/server";
import { z } from "zod";
import { verifyToken } from "@/server/auth/verify-token";
import { requireRole } from "@/server/auth/require-role";
import { teacherResourcesService } from "@/server/services/teacher-resources.service";
import { ok, fail } from "@/server/utils/response";

const CreateSchema = z.object({
  kind: z.enum(["link", "image"]),
  title: z.string().min(1).max(120),
  url: z.string().url(),
  description: z.string().max(500).optional(),
  publicId: z.string().optional(),
  tags: z.array(z.string().max(40)).max(10).default([]),
});

export async function GET(req: NextRequest) {
  try {
    const user = await verifyToken(req);
    requireRole(user, ["teacher"]);
    const items = await teacherResourcesService.list(user.uid);
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
    const item = await teacherResourcesService.create(user.uid, body);
    return ok(item, 201);
  } catch (e) {
    return fail(e);
  }
}
