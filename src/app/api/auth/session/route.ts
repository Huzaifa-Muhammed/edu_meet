export const dynamic = "force-dynamic";
import "server-only";
import { NextRequest } from "next/server";
import { adminAuth, adminDb } from "@/server/firebase-admin";
import { Collections } from "@/shared/constants/collections";
import { SessionRequestSchema } from "@/shared/schemas/auth.schema";
import { ok, fail } from "@/server/utils/response";

export async function POST(req: NextRequest) {
  try {
    const body = SessionRequestSchema.parse(await req.json());
    const decoded = await adminAuth.verifyIdToken(body.idToken);

    const userRef = adminDb.collection(Collections.USERS).doc(decoded.uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      const newUser = {
        email: decoded.email ?? "",
        displayName: decoded.name ?? decoded.email?.split("@")[0] ?? "",
        photoUrl: decoded.picture ?? null,
        role: body.role ?? "student",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await userRef.set(newUser);
      return ok({ uid: decoded.uid, ...newUser }, 201);
    }

    const data = userDoc.data()!;
    // Return the full user doc so the client sees subjects, bio, etc.
    return ok({
      uid: decoded.uid,
      ...data,
    });
  } catch (e) {
    return fail(e);
  }
}
