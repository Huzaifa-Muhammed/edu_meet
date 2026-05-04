export const dynamic = "force-dynamic";
import "server-only";
import type { NextRequest } from "next/server";
import { verifyToken } from "@/server/auth/verify-token";
import { requireRole } from "@/server/auth/require-role";
import { teacherApplicationsService } from "@/server/services/teacher-applications.service";
import { ok, fail } from "@/server/utils/response";

export async function GET(req: NextRequest) {
  try {
    const auth = await verifyToken(req);
    requireRole(auth, ["admin"]);
    const status = req.nextUrl.searchParams.get("status") as
      | "pending"
      | "approved"
      | "rejected"
      | null;
    const items = await teacherApplicationsService.listAll(status ?? undefined);
    return ok(items);
  } catch (e) {
    return fail(e);
  }
}
