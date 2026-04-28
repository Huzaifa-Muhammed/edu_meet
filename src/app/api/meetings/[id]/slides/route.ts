export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import "server-only";
import { NextRequest } from "next/server";
import { verifyToken } from "@/server/auth/verify-token";
import { requireRole } from "@/server/auth/require-role";
import { meetingsService } from "@/server/services/meetings.service";
import { slidesService } from "@/server/services/slides.service";
import { ok, fail } from "@/server/utils/response";
import { forbidden, badRequest } from "@/server/utils/errors";

/** GET — list slides for a meeting.
 *  Accessible to any authenticated user (teacher or enrolled student). */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    await verifyToken(req);
    const { id } = await ctx.params;
    const list = await slidesService.list(id);
    return ok(list);
  } catch (e) {
    return fail(e);
  }
}

/** POST — upload one or more image slides (multipart/form-data, field `files`). */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const user = await verifyToken(req);
    requireRole(user, ["teacher"]);
    const { id } = await ctx.params;

    const meeting = (await meetingsService.getById(id)) as unknown as {
      teacherId: string;
    };
    if (meeting.teacherId !== user.uid) throw forbidden("Not your meeting");

    const form = await req.formData();
    const files = form.getAll("files");
    if (!files.length) throw badRequest("No files uploaded");

    const created = [];
    for (const f of files) {
      if (!(f instanceof File)) continue;
      const buffer = Buffer.from(await f.arrayBuffer());
      const slide = await slidesService.add({
        meetingId: id,
        buffer,
        filename: f.name,
        contentType: f.type || "image/png",
      });
      created.push(slide);
    }
    return ok(created);
  } catch (e) {
    return fail(e);
  }
}
