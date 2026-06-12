export const dynamic = "force-dynamic";
import "server-only";
import { NextRequest } from "next/server";
import { z } from "zod";
import { verifyToken } from "@/server/auth/verify-token";
import { requireRole } from "@/server/auth/require-role";
import { courseContentService } from "@/server/services/course-content.service";
import { ok, fail } from "@/server/utils/response";
import { badRequest } from "@/server/utils/errors";

const ItemSchema = z.object({
  topic: z.string().trim().min(1).max(300),
  grade: z.string().trim().max(60).optional().default(""),
  syllabus: z.string().trim().max(120).optional().default(""),
  link: z.string().trim().url().max(2000),
});

const UpsertSchema = z.object({
  subjectId: z.string().trim().max(80).optional(),
  subjectName: z.string().trim().min(1).max(120),
  fileName: z.string().trim().max(260).optional(),
  items: z.array(ItemSchema).min(1).max(1000),
});

export async function GET(req: NextRequest) {
  try {
    const auth = await verifyToken(req);
    requireRole(auth, ["admin"]);
    const items = await courseContentService.listAll();
    return ok(items);
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyToken(req);
    requireRole(auth, ["admin"]);
    const parsed = UpsertSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw badRequest("Invalid course-content payload");
    const saved = await courseContentService.upsert({
      ...parsed.data,
      uploadedBy: auth.uid,
    });
    return ok(saved);
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await verifyToken(req);
    requireRole(auth, ["admin"]);
    const key = req.nextUrl.searchParams.get("key");
    if (!key) throw badRequest("Missing subject key");
    await courseContentService.remove(key);
    return ok({ removed: true });
  } catch (e) {
    return fail(e);
  }
}
