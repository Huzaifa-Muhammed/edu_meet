export const dynamic = "force-dynamic";
import "server-only";
import { NextRequest } from "next/server";
import { z } from "zod";
import { verifyToken } from "@/server/auth/verify-token";
import { requireRole } from "@/server/auth/require-role";
import { supportService } from "@/server/services/support.service";
import { ok, fail } from "@/server/utils/response";

const Schema = z.object({
  problemType: z.enum(["technical", "lesson", "account", "other"]),
  subject: z.string().min(2).max(120),
  details: z.string().min(5).max(2000),
  priority: z.enum(["low", "normal", "high"]).default("normal"),
});

export async function POST(req: NextRequest) {
  try {
    const user = await verifyToken(req);
    requireRole(user, ["student"]);
    const body = Schema.parse(await req.json());
    const ticket = await supportService.create(user.uid, body);
    return ok(ticket, 201);
  } catch (e) {
    return fail(e);
  }
}
