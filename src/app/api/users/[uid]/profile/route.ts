export const dynamic = "force-dynamic";
import "server-only";
import { NextRequest } from "next/server";
import { verifyToken } from "@/server/auth/verify-token";
import { usersService } from "@/server/services/users.service";
import { ok, fail } from "@/server/utils/response";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string }> },
) {
  try {
    await verifyToken(req);
    const { uid } = await params;
    const profile = await usersService.getProfile(uid);
    return ok(profile);
  } catch (e) {
    return fail(e);
  }
}
