export const dynamic = "force-dynamic";
import "server-only";
import { NextRequest } from "next/server";
import { verifyToken } from "@/server/auth/verify-token";
import { requireRole } from "@/server/auth/require-role";
import { adminDb } from "@/server/firebase-admin";
import { Collections } from "@/shared/constants/collections";
import { ok, fail } from "@/server/utils/response";

/** Marks the student's schedule as "seen" so the new-schedule popup stops
 *  showing until the next time a class is approved for their subjects. */
export async function POST(req: NextRequest) {
  try {
    const user = await verifyToken(req);
    requireRole(user, ["student"]);
    await adminDb
      .collection(Collections.USERS)
      .doc(user.uid)
      .set({ scheduleSeenAt: new Date().toISOString() }, { merge: true });
    return ok({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
