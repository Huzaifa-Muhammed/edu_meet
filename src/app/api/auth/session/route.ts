export const dynamic = "force-dynamic";
import "server-only";
import { NextRequest } from "next/server";
import { adminAuth, adminDb } from "@/server/firebase-admin";
import { Collections } from "@/shared/constants/collections";
import { SessionRequestSchema } from "@/shared/schemas/auth.schema";
import { ok, fail } from "@/server/utils/response";
import { forbidden } from "@/server/utils/errors";

export async function POST(req: NextRequest) {
  try {
    const body = SessionRequestSchema.parse(await req.json());
    const decoded = await adminAuth.verifyIdToken(body.idToken);

    const userRef = adminDb.collection(Collections.USERS).doc(decoded.uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      const role = body.role ?? "student";
      const newUser = {
        email: decoded.email ?? "",
        displayName: decoded.name ?? decoded.email?.split("@")[0] ?? "",
        photoUrl: decoded.picture ?? null,
        role,
        // Teachers must complete the application before accessing the portal.
        applicationStatus: role === "teacher" ? "none" : "approved",
        blocked: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await userRef.set(newUser);
      return ok({ uid: decoded.uid, ...newUser }, 201);
    }

    const data = userDoc.data()!;

    if (data.blocked) {
      throw forbidden("Your account has been blocked. Contact support.");
    }

    // Return the full user doc so the client sees subjects, bio, etc.
    return ok({
      uid: decoded.uid,
      ...data,
    });
  } catch (e) {
    return fail(e);
  }
}
