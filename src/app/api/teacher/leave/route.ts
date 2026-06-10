export const dynamic = "force-dynamic";
import "server-only";
import { NextRequest } from "next/server";
import { verifyToken } from "@/server/auth/verify-token";
import { requireRole } from "@/server/auth/require-role";
import { leaveService } from "@/server/services/leave.service";
import { LeaveCreateSchema } from "@/shared/schemas/leave.schema";
import { ok, fail } from "@/server/utils/response";

export async function GET(req: NextRequest) {
  try {
    const user = await verifyToken(req);
    requireRole(user, ["teacher"]);
    const items = await leaveService.listForTeacher(user.uid);
    return ok(items);
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await verifyToken(req);
    requireRole(user, ["teacher"]);
    const input = LeaveCreateSchema.parse(await req.json());
    const created = await leaveService.create(
      { uid: user.uid, displayName: user.displayName, email: user.email },
      input,
    );
    return ok(created);
  } catch (e) {
    return fail(e);
  }
}
