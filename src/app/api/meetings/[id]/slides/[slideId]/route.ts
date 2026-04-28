export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import "server-only";
import { NextRequest } from "next/server";
import { verifyToken } from "@/server/auth/verify-token";
import { requireRole } from "@/server/auth/require-role";
import { meetingsService } from "@/server/services/meetings.service";
import { slidesService } from "@/server/services/slides.service";
import { ok, fail } from "@/server/utils/response";
import { forbidden } from "@/server/utils/errors";

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; slideId: string }> },
) {
  try {
    const user = await verifyToken(req);
    requireRole(user, ["teacher"]);
    const { id, slideId } = await ctx.params;

    const meeting = (await meetingsService.getById(id)) as unknown as {
      teacherId: string;
    };
    if (meeting.teacherId !== user.uid) throw forbidden("Not your meeting");

    await slidesService.remove(id, slideId);
    return ok({ removed: slideId });
  } catch (e) {
    return fail(e);
  }
}
