export const dynamic = "force-dynamic";
import "server-only";
import { NextRequest } from "next/server";
import { verifyToken } from "@/server/auth/verify-token";
import { requireRole } from "@/server/auth/require-role";
import { adminDb } from "@/server/firebase-admin";
import { Collections } from "@/shared/constants/collections";
import { ok, fail } from "@/server/utils/response";
import { z } from "zod";

const SubjectCreateSchema = z.object({
  name: z.string().min(1),
  gradeLevels: z.array(z.number().int()),
});

export async function GET(req: NextRequest) {
  try {
    await verifyToken(req);
    const snap = await adminDb.collection(Collections.SUBJECTS).get();
    return ok(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await verifyToken(req);
    requireRole(user, ["admin"]);
    const body = SubjectCreateSchema.parse(await req.json());
    const ref = await adminDb.collection(Collections.SUBJECTS).add(body);
    return ok({ id: ref.id, ...body }, 201);
  } catch (e) {
    return fail(e);
  }
}
