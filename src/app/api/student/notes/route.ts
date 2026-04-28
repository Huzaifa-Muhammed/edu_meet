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
  text: z.string().min(1).max(4000),
  tags: z.array(z.string().min(1).max(24)).max(10).default([]),
});

export async function GET(req: NextRequest) {
  try {
    const user = await verifyToken(req);
    requireRole(user, ["student"]);
    const url = new URL(req.url);
    const meetingId = url.searchParams.get("meetingId");
    if (!meetingId) return ok([]);

    const snap = await adminDb
      .collection(Collections.STUDENT_NOTES)
      .doc(user.uid)
      .collection(meetingId)
      .orderBy("createdAt", "desc")
      .get();
    return ok(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await verifyToken(req);
    requireRole(user, ["student"]);
    const body = Body.parse(await req.json());
    const ref = await adminDb
      .collection(Collections.STUDENT_NOTES)
      .doc(user.uid)
      .collection(body.meetingId)
      .add({
        text: body.text,
        tags: body.tags,
        createdAt: new Date().toISOString(),
      });
    return ok({ id: ref.id, ...body }, 201);
  } catch (e) {
    return fail(e);
  }
}
