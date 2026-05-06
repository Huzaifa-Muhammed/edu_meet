export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import "server-only";
import type { NextRequest } from "next/server";
import { verifyToken } from "@/server/auth/verify-token";
import { requireRole } from "@/server/auth/require-role";
import { uploadImageBuffer } from "@/server/providers/cloudinary";
import { ok, fail } from "@/server/utils/response";
import { badRequest } from "@/server/utils/errors";

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"];

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyToken(req);
    requireRole(auth, ["teacher"]);
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw badRequest("Missing file");
    if (file.size > MAX_BYTES) throw badRequest("File too large (max 8MB)");
    if (file.type && !ALLOWED.includes(file.type))
      throw badRequest("Unsupported image type");

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await uploadImageBuffer(buffer, {
      folder: `edumeet/teacher-credentials/${auth.uid}`,
      filename: file.name,
    });
    return ok(result, 201);
  } catch (e) {
    return fail(e);
  }
}
