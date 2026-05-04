import "server-only";
import type { NextRequest } from "next/server";
import { adminAuth, adminDb } from "@/server/firebase-admin";
import { Collections } from "@/shared/constants/collections";
import { unauthorized } from "@/server/utils/errors";
import type { AuthUser } from "@/shared/types/api";

/**
 * Extract + verify the Firebase ID token from the Authorization header.
 * Returns the decoded user with role loaded from Firestore.
 */
export async function verifyToken(req: NextRequest): Promise<AuthUser> {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) {
    throw unauthorized("Missing or malformed Authorization header");
  }

  const idToken = header.slice(7);

  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    const userDoc = await adminDb
      .collection(Collections.USERS)
      .doc(decoded.uid)
      .get();

    if (!userDoc.exists) {
      throw unauthorized("User profile not found");
    }

    const data = userDoc.data()!;
    if (data.blocked) {
      throw unauthorized("Account is blocked");
    }
    return {
      uid: decoded.uid,
      email: decoded.email ?? data.email,
      role: data.role,
      displayName: data.displayName ?? decoded.name ?? "",
      photoUrl: data.photoUrl ?? decoded.picture,
    };
  } catch (err) {
    if (err instanceof Error && err.name === "ApiError") throw err;
    throw unauthorized("Invalid or expired token");
  }
}
