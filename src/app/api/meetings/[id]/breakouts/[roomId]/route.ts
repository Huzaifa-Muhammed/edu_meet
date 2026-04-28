export const dynamic = "force-dynamic";
import "server-only";
import { NextRequest } from "next/server";
import { z } from "zod";
import { verifyToken } from "@/server/auth/verify-token";
import { breakoutsService } from "@/server/services/breakouts.service";
import { ok, fail } from "@/server/utils/response";

const PatchSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  icon: z.string().max(8).optional(),
  members: z.array(z.string()).max(30).optional(),
  timerSec: z.number().int().min(0).max(60 * 60).nullable().optional(),
  closed: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; roomId: string }> },
) {
  try {
    const user = await verifyToken(req);
    const { id, roomId } = await params;
    const body = PatchSchema.parse(await req.json());
    const result = await breakoutsService.patch(id, roomId, user.uid, body);
    return ok(result);
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; roomId: string }> },
) {
  try {
    const user = await verifyToken(req);
    const { id, roomId } = await params;
    const result = await breakoutsService.remove(id, roomId, user.uid);
    return ok(result);
  } catch (e) {
    return fail(e);
  }
}
