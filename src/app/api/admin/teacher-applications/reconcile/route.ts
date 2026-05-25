export const dynamic = "force-dynamic";
import "server-only";
import type { NextRequest } from "next/server";
import { verifyToken } from "@/server/auth/verify-token";
import { requireRole } from "@/server/auth/require-role";
import { teacherApplicationsService } from "@/server/services/teacher-applications.service";
import { adminDb } from "@/server/firebase-admin";
import { Collections } from "@/shared/constants/collections";
import { ok, fail } from "@/server/utils/response";

/**
 * One-time migration:
 *  1. Copy any historical `teacherApplications/*` docs onto the matching
 *     `users/{uid}` doc.
 *  2. Mirror legacy field names on user docs so the new code's reads always
 *     resolve: `applicationStatus` ↔ `status`, `displayName` ↔ `name`.
 *
 * Safe to re-run.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await verifyToken(req);
    requireRole(auth, ["admin"]);

    const legacyResult =
      await teacherApplicationsService.migrateFromLegacyCollection();

    // Backfill canonical fields on all teacher user docs
    const teachersSnap = await adminDb
      .collection(Collections.USERS)
      .where("role", "==", "teacher")
      .get();
    let normalized = 0;
    for (const d of teachersSnap.docs) {
      const u = d.data() as {
        status?: string;
        applicationStatus?: string;
        name?: string;
        displayName?: string;
      };
      const patch: Record<string, string> = {};
      if (u.status && !u.applicationStatus) patch.applicationStatus = u.status;
      if (u.applicationStatus && !u.status) patch.status = u.applicationStatus;
      if (u.name && !u.displayName) patch.displayName = u.name;
      if (u.displayName && !u.name) patch.name = u.displayName;
      if (Object.keys(patch).length === 0) continue;
      await d.ref.set({ ...patch, updatedAt: new Date().toISOString() }, { merge: true });
      normalized++;
    }

    return ok({ ...legacyResult, normalized });
  } catch (e) {
    return fail(e);
  }
}

/** Health-check: where everyone is. */
export async function GET(req: NextRequest) {
  try {
    const auth = await verifyToken(req);
    requireRole(auth, ["admin"]);
    const [legacy, users] = await Promise.all([
      adminDb.collection(Collections.TEACHER_APPLICATIONS).get(),
      adminDb.collection(Collections.USERS).where("role", "==", "teacher").get(),
    ]);
    const byStatus = { pending: 0, approved: 0, rejected: 0, none: 0, missing: 0 };
    let missingNameMirror = 0;
    let missingStatusMirror = 0;
    for (const d of users.docs) {
      const u = d.data() as {
        status?: string;
        applicationStatus?: string;
        name?: string;
        displayName?: string;
      };
      const eff = u.status ?? u.applicationStatus;
      if (eff === "pending") byStatus.pending++;
      else if (eff === "approved") byStatus.approved++;
      else if (eff === "rejected") byStatus.rejected++;
      else if (eff === "none") byStatus.none++;
      else byStatus.missing++;
      if (
        (u.name && !u.displayName) ||
        (u.displayName && !u.name)
      )
        missingNameMirror++;
      if (
        (u.status && !u.applicationStatus) ||
        (u.applicationStatus && !u.status)
      )
        missingStatusMirror++;
    }
    return ok({
      legacyDocs: legacy.size,
      teacherUsers: users.size,
      byStatus,
      missingNameMirror,
      missingStatusMirror,
    });
  } catch (e) {
    return fail(e);
  }
}
