export const dynamic = "force-dynamic";
import "server-only";
import { NextRequest } from "next/server";
import { z } from "zod";
import { verifyToken } from "@/server/auth/verify-token";
import { requireRole } from "@/server/auth/require-role";
import { adminDb } from "@/server/firebase-admin";
import { Collections } from "@/shared/constants/collections";
import { ok, fail } from "@/server/utils/response";

const Body = z.object({
  meetingId: z.string().min(1),
  type: z.enum(["ok", "unsure", "confused"]),
});

/**
 * Durable mirror of the REACTION pubsub. Teacher side primarily watches the
 * pubsub channel, but this gives us a record for end-of-class analytics.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await verifyToken(req);
    requireRole(user, ["student"]);
    const { id: classroomId } = await params;
    const body = Body.parse(await req.json());

    await adminDb.collection(Collections.REACTIONS).add({
      classroomId,
      meetingId: body.meetingId,
      uid: user.uid,
      type: body.type,
      at: new Date().toISOString(),
    });
    return ok({ saved: true }, 201);
  } catch (e) {
    return fail(e);
  }
}
