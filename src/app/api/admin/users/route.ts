export const dynamic = "force-dynamic";
import "server-only";
import type { NextRequest } from "next/server";
import { verifyToken } from "@/server/auth/verify-token";
import { requireRole } from "@/server/auth/require-role";
import { usersService } from "@/server/services/users.service";
import { ok, fail } from "@/server/utils/response";

export async function GET(req: NextRequest) {
  try {
    const auth = await verifyToken(req);
    requireRole(auth, ["admin"]);
    const role = req.nextUrl.searchParams.get("role") as
      | "teacher"
      | "student"
      | "admin"
      | "parent"
      | null;
    const users = await usersService.listByRole(role ?? undefined);
    return ok(users);
  } catch (e) {
    return fail(e);
  }
}
