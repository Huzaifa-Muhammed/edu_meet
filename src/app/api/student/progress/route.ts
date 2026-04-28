export const dynamic = "force-dynamic";
import "server-only";
import { NextRequest } from "next/server";
import { verifyToken } from "@/server/auth/verify-token";
import { requireRole } from "@/server/auth/require-role";
import { studentProgressService } from "@/server/services/student-progress.service";
import { ok, fail } from "@/server/utils/response";

export async function GET(req: NextRequest) {
  try {
    const user = await verifyToken(req);
    requireRole(user, ["student"]);
    const data = await studentProgressService.summary(user.uid);
    return ok(data);
  } catch (e) {
    return fail(e);
  }
}
