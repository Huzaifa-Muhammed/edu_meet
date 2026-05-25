export const dynamic = "force-dynamic";
import "server-only";
import { NextRequest } from "next/server";
import { verifyToken } from "@/server/auth/verify-token";
import { requireRole } from "@/server/auth/require-role";
import { teacherResourcesService } from "@/server/services/teacher-resources.service";
import { destroyImage } from "@/server/providers/cloudinary";
import { ok, fail } from "@/server/utils/response";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await verifyToken(req);
    requireRole(user, ["teacher"]);
    const { id } = await params;
    const res = await teacherResourcesService.remove(user.uid, id);
    if (res.publicId) {
      try {
        await destroyImage(res.publicId);
      } catch (err) {
        console.warn("[teacher-resources] cloudinary destroy failed:", err);
      }
    }
    return ok({ removed: true });
  } catch (e) {
    return fail(e);
  }
}
