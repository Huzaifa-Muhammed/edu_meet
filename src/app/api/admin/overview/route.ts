export const dynamic = "force-dynamic";
import "server-only";
import type { NextRequest } from "next/server";
import { verifyToken } from "@/server/auth/verify-token";
import { requireRole } from "@/server/auth/require-role";
import { adminDb } from "@/server/firebase-admin";
import { Collections } from "@/shared/constants/collections";
import { ok, fail } from "@/server/utils/response";

export async function GET(req: NextRequest) {
  try {
    const auth = await verifyToken(req);
    requireRole(auth, ["admin"]);

    const usersSnap = await adminDb.collection(Collections.USERS).get();
    let teachers = 0,
      students = 0,
      blocked = 0;
    usersSnap.docs.forEach((d) => {
      const data = d.data() as { role?: string; blocked?: boolean };
      if (data.role === "teacher") teachers++;
      if (data.role === "student") students++;
      if (data.blocked) blocked++;
    });

    const pendingAppsSnap = await adminDb
      .collection(Collections.TEACHER_APPLICATIONS)
      .where("status", "==", "pending")
      .get();

    const openTicketsSnap = await adminDb
      .collection(Collections.SUPPORT_TICKETS)
      .where("status", "==", "open")
      .get();

    const classroomsSnap = await adminDb
      .collection(Collections.CLASSROOMS)
      .get();

    return ok({
      totalUsers: usersSnap.size,
      teachers,
      students,
      blocked,
      pendingApplications: pendingAppsSnap.size,
      openTickets: openTicketsSnap.size,
      classrooms: classroomsSnap.size,
    });
  } catch (e) {
    return fail(e);
  }
}
