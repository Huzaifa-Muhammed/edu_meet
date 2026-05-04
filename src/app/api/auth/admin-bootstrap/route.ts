export const dynamic = "force-dynamic";
import "server-only";
import { NextRequest } from "next/server";
import { adminAuth, adminDb } from "@/server/firebase-admin";
import { Collections } from "@/shared/constants/collections";
import { ok, fail } from "@/server/utils/response";
import { badRequest } from "@/server/utils/errors";

const ADMIN_EMAIL = "admin@spark.com";
const ADMIN_PASSWORD = "123456";
const ADMIN_DISPLAY_NAME = "Spark Admin";

/**
 * Ensures the hidden admin account exists. Called by the login page
 * when the user types the special admin credentials. Idempotent —
 * subsequent calls are no-ops.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      email?: string;
      password?: string;
    };

    if (body.email !== ADMIN_EMAIL || body.password !== ADMIN_PASSWORD) {
      throw badRequest("Invalid admin credentials");
    }

    let userRecord;
    try {
      userRecord = await adminAuth.getUserByEmail(ADMIN_EMAIL);
    } catch {
      userRecord = await adminAuth.createUser({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        displayName: ADMIN_DISPLAY_NAME,
        emailVerified: true,
      });
    }

    const userRef = adminDb.collection(Collections.USERS).doc(userRecord.uid);
    const userSnap = await userRef.get();
    const now = new Date().toISOString();

    if (!userSnap.exists) {
      await userRef.set({
        email: ADMIN_EMAIL,
        displayName: ADMIN_DISPLAY_NAME,
        role: "admin",
        applicationStatus: "approved",
        createdAt: now,
        updatedAt: now,
      });
    } else {
      const data = userSnap.data() ?? {};
      if (data.role !== "admin") {
        await userRef.set(
          { role: "admin", updatedAt: now },
          { merge: true },
        );
      }
    }

    return ok({ uid: userRecord.uid, email: ADMIN_EMAIL });
  } catch (e) {
    return fail(e);
  }
}
