export const dynamic = "force-dynamic";
import "server-only";
import { NextRequest } from "next/server";
import { z } from "zod";
import { verifyToken } from "@/server/auth/verify-token";
import { breakoutsService } from "@/server/services/breakouts.service";
import { ok, fail } from "@/server/utils/response";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await verifyToken(req);
    const { id } = await params;
    const rooms = await breakoutsService.list(id);
    return ok(rooms);
  } catch (e) {
    return fail(e);
  }
}

const CreateSchema = z.object({
  name: z.string().min(1).max(80),
  icon: z.string().max(8).optional(),
  members: z.array(z.string()).max(30).optional(),
  timerSec: z.number().int().min(0).max(60 * 60).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await verifyToken(req);
    const { id } = await params;
    const body = CreateSchema.parse(await req.json());
    const room = await breakoutsService.create(id, user.uid, body);
    return ok(room, 201);
  } catch (e) {
    return fail(e);
  }
}
