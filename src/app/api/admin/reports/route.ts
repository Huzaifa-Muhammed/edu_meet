export const dynamic = "force-dynamic";
import "server-only";
import type { NextRequest } from "next/server";
import { verifyToken } from "@/server/auth/verify-token";
import { requireRole } from "@/server/auth/require-role";
import { supportService } from "@/server/services/support.service";
import { adminDb } from "@/server/firebase-admin";
import { Collections } from "@/shared/constants/collections";
import { ok, fail } from "@/server/utils/response";
import type { User } from "@/shared/types/domain";

export async function GET(req: NextRequest) {
  try {
    const auth = await verifyToken(req);
    requireRole(auth, ["admin"]);
    const status = req.nextUrl.searchParams.get("status") as
      | "open"
      | "resolved"
      | null;
    const tickets = await supportService.listAll(status ?? undefined);

    // Hydrate ticket reporter info so admin sees who submitted each report.
    const uids = Array.from(new Set(tickets.map((t) => t.uid)));
    const userDocs = await Promise.all(
      uids.map((uid) =>
        adminDb.collection(Collections.USERS).doc(uid).get(),
      ),
    );
    const userMap = new Map<string, Partial<User>>();
    userDocs.forEach((doc) => {
      if (doc.exists) {
        userMap.set(doc.id, doc.data() as Partial<User>);
      }
    });

    const enriched = tickets.map((t) => {
      const u = userMap.get(t.uid);
      return {
        ...t,
        reporterName: u?.displayName ?? "Unknown",
        reporterEmail: u?.email ?? "",
        reporterRole: u?.role ?? "student",
      };
    });

    return ok(enriched);
  } catch (e) {
    return fail(e);
  }
}
