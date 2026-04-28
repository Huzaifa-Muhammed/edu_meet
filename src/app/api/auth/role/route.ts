export const dynamic = "force-dynamic";
import "server-only";
import { NextRequest } from "next/server";
import { verifyToken } from "@/server/auth/verify-token";
import { requireRole } from "@/server/auth/require-role";
import { RoleAssignSchema } from "@/shared/schemas/auth.schema";
import { adminDb } from "@/server/firebase-admin";
import { Collections } from "@/shared/constants/collections";
import { ok, fail } from "@/server/utils/response";

export async function POST(req: NextRequest) {
  try {
    const user = await verifyToken(req);
    requireRole(user, ["admin"]);

    const body = RoleAssignSchema.parse(await req.json());
    await adminDb
      .collection(Collections.USERS)
      .doc(body.uid)
      .update({ role: body.role, updatedAt: new Date().toISOString() });

    return ok({ uid: body.uid, role: body.role });
  } catch (e) {
    return fail(e);
  }
}
