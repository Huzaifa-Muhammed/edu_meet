export const dynamic = "force-dynamic";
import "server-only";
import { NextRequest } from "next/server";
import { verifyToken } from "@/server/auth/verify-token";
import { requireRole } from "@/server/auth/require-role";
import { UserUpdateSchema } from "@/shared/schemas/user.schema";
import { usersService } from "@/server/services/users.service";
import { ok, fail } from "@/server/utils/response";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string }> },
) {
  try {
    await verifyToken(req);
    const { uid } = await params;
    const user = await usersService.getByUid(uid);
    return ok(user);
  } catch (e) {
    return fail(e);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string }> },
) {
  try {
    const caller = await verifyToken(req);
    const { uid } = await params;

    // Only self or admin can update
    if (caller.uid !== uid) requireRole(caller, ["admin"]);

    const body = UserUpdateSchema.parse(await req.json());
    const updated = await usersService.update(uid, body);
    return ok(updated);
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string }> },
) {
  try {
    const caller = await verifyToken(req);
    const { uid } = await params;

    if (caller.uid !== uid) requireRole(caller, ["admin"]);

    await usersService.remove(uid);
    return ok({ deleted: true });
  } catch (e) {
    return fail(e);
  }
}
