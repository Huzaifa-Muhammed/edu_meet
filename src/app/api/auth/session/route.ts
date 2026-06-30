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
      const displayName = decoded.name ?? decoded.email?.split("@")[0] ?? "";
      const newUser = {
        email: decoded.email ?? "",
        displayName,
        // `name` mirrors `displayName` for back-compat with legacy/manual docs
        // that only set `name`. Both fields stay in sync going forward.
        name: displayName,
        photoUrl: decoded.picture ?? null,
        role,
        // Teachers must complete the application before accessing the portal.
        // Canonical field is `status`; legacy docs sometimes used
        // `applicationStatus` — readers should accept either.
        status: role === "teacher" ? "none" : "approved",
        // Student grade + exam board captured at signup (editable later in the
        // student profile). Only meaningful for students.
        ...(role === "student" && typeof body.grade === "number"
          ? { grade: body.grade }
          : {}),
        ...(role === "student" && body.syllabus
          ? { syllabus: body.syllabus }
          : {}),
        blocked: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await userRef.set(newUser);
      return ok({ uid: decoded.uid, ...newUser, applicationStatus: newUser.status }, 201);
    }

    const data = userDoc.data()!;

    if (data.blocked) {
      throw forbidden("Your account has been blocked. Contact support.");
    }

    // Normalise legacy field names so the client always sees both shapes.
    // The rest of the app reads `applicationStatus` and `displayName`;
    // some Firestore docs only have `status` and `name`.
    const normalized = {
      ...data,
      applicationStatus: data.applicationStatus ?? data.status,
      status: data.status ?? data.applicationStatus,
      displayName: data.displayName ?? data.name,
      name: data.name ?? data.displayName,
    };

    return ok({
      uid: decoded.uid,
      ...normalized,
    });
  } catch (e) {
    return fail(e);
  }
}
