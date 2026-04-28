export const dynamic = "force-dynamic";
import "server-only";
import { NextRequest } from "next/server";
import { verifyToken } from "@/server/auth/verify-token";
import { UserUpdateSchema } from "@/shared/schemas/user.schema";
import { adminDb } from "@/server/firebase-admin";
import { Collections } from "@/shared/constants/collections";
import { ok, fail } from "@/server/utils/response";

export async function GET(req: NextRequest) {
  try {
    const user = await verifyToken(req);
    const doc = await adminDb
      .collection(Collections.USERS)
      .doc(user.uid)
      .get();

    return ok({ uid: user.uid, ...doc.data() });
  } catch (e) {
    return fail(e);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await verifyToken(req);
    const body = UserUpdateSchema.parse(await req.json());

    await adminDb
      .collection(Collections.USERS)
      .doc(user.uid)
      .update({ ...body, updatedAt: new Date().toISOString() });

    return ok({ uid: user.uid, ...body });
  } catch (e) {
    return fail(e);
  }
}
