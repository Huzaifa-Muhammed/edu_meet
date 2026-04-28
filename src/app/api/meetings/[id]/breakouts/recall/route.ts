export const dynamic = "force-dynamic";
import "server-only";
import { NextRequest } from "next/server";
import { verifyToken } from "@/server/auth/verify-token";
import { breakoutsService } from "@/server/services/breakouts.service";
import { ok, fail } from "@/server/utils/response";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await verifyToken(req);
    const { id } = await params;
    const result = await breakoutsService.recallAll(id, user.uid);
    return ok(result);
  } catch (e) {
    return fail(e);
  }
}
