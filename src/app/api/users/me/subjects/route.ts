export const dynamic = "force-dynamic";
import "server-only";
import { NextRequest } from "next/server";
import { z } from "zod";
import { verifyToken } from "@/server/auth/verify-token";
import { adminDb } from "@/server/firebase-admin";
import { Collections } from "@/shared/constants/collections";
import { ok, fail } from "@/server/utils/response";

const BodySchema = z.object({
  subjects: z.array(z.string().min(1)).max(20),
});

export async function PATCH(req: NextRequest) {
  try {
    const user = await verifyToken(req);
    const { subjects } = BodySchema.parse(await req.json());
    await adminDb
      .collection(Collections.USERS)
      .doc(user.uid)
      .update({ subjects, updatedAt: new Date().toISOString() });
    return ok({ subjects });
  } catch (e) {
    return fail(e);
  }
}
