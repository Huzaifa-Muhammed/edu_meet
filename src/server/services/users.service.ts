import "server-only";
import { adminDb } from "@/server/firebase-admin";
import { Collections } from "@/shared/constants/collections";
import { notFound } from "@/server/utils/errors";
import { sendEmail } from "@/server/providers/email";
import { UserBlockedEmail } from "@/server/email/templates/user-blocked";
import { UserUnblockedEmail } from "@/server/email/templates/user-unblocked";
import type { UserUpdateInput } from "@/shared/schemas/user.schema";
import type { User } from "@/shared/types/domain";

export const usersService = {
  async getByUid(uid: string) {
    const doc = await adminDb.collection(Collections.USERS).doc(uid).get();
    if (!doc.exists) throw notFound("User");
    return { uid: doc.id, ...doc.data() };
  },

  async update(uid: string, data: UserUpdateInput) {
    await adminDb.collection(Collections.USERS).doc(uid).update({
      ...data,
      updatedAt: new Date().toISOString(),
    });
    return { uid, ...data };
  },

  async remove(uid: string) {
    await adminDb.collection(Collections.USERS).doc(uid).delete();
  },

  async getProfile(uid: string) {
    const user = await usersService.getByUid(uid);

    // Aggregate stats
    const meetingsSnap = await adminDb
      .collection(Collections.MEETINGS)
      .where("teacherId", "==", uid)
      .get();

    const classroomsSnap = await adminDb
      .collection(Collections.CLASSROOMS)
      .where("teacherId", "==", uid)
      .get();

    return {
      ...user,
      stats: {
        totalMeetings: meetingsSnap.size,
        totalClassrooms: classroomsSnap.size,
      },
    };
  },

  async listByRole(role?: "teacher" | "student" | "admin" | "parent") {
    let q: FirebaseFirestore.Query = adminDb.collection(Collections.USERS);
    if (role) q = q.where("role", "==", role);
    const snap = await q.get();
    const users = snap.docs.map((d) => ({
      uid: d.id,
      ...(d.data() as Omit<User, "uid">),
    })) as User[];
    users.sort((a, b) =>
      (a.displayName ?? "").localeCompare(b.displayName ?? ""),
    );
    return users;
  },

  async setBlocked(uid: string, blocked: boolean, reason?: string) {
    const now = new Date().toISOString();
    const update: Record<string, unknown> = {
      blocked,
      updatedAt: now,
    };
    if (blocked) {
      update.blockedAt = now;
      update.blockReason = reason ?? null;
    } else {
      update.blockedAt = null;
      update.blockReason = null;
    }
    await adminDb.collection(Collections.USERS).doc(uid).update(update);

    // Fire-and-forget email notice. Pull name + email off the doc.
    try {
      const fresh = await adminDb.collection(Collections.USERS).doc(uid).get();
      const data = fresh.data() as User | undefined;
      if (data?.email) {
        const base =
          process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";
        const supportEmail = process.env.EMAIL_REPLY_TO?.trim();
        if (blocked) {
          sendEmail({
            to: data.email,
            subject: "Your EduMeet account has been suspended",
            templateKey: "user-blocked",
            react: UserBlockedEmail({
              name: data.displayName ?? "",
              reason,
              supportEmail:
                supportEmail && supportEmail.length > 0 ? supportEmail : undefined,
            }),
          }).catch((err) => console.error("[email]", err));
        } else {
          sendEmail({
            to: data.email,
            subject: "Your EduMeet account has been reinstated",
            templateKey: "user-unblocked",
            react: UserUnblockedEmail({
              name: data.displayName ?? "",
              loginUrl: `${base}/auth/login`,
            }),
          }).catch((err) => console.error("[email]", err));
        }
      }
    } catch (err) {
      console.warn("[email] failed to dispatch block notice", err);
    }

    return { uid, blocked };
  },

  async getDetail(uid: string) {
    const user = (await usersService.getByUid(uid)) as User;

    if (user.role === "teacher") {
      const meetingsSnap = await adminDb
        .collection(Collections.MEETINGS)
        .where("teacherId", "==", uid)
        .get();
      const classroomsSnap = await adminDb
        .collection(Collections.CLASSROOMS)
        .where("teacherId", "==", uid)
        .get();
      return {
        ...user,
        stats: {
          totalClassrooms: classroomsSnap.size,
          totalMeetings: meetingsSnap.size,
        },
      };
    }

    if (user.role === "student") {
      const classroomsSnap = await adminDb
        .collection(Collections.CLASSROOMS)
        .where("studentIds", "array-contains", uid)
        .get();

      const submissionsSnap = await adminDb
        .collection(Collections.ASSESSMENT_SUBMISSIONS)
        .where("uid", "==", uid)
        .get();

      const tokenDoc = await adminDb
        .collection(Collections.BRAIN_TOKENS)
        .doc(uid)
        .get();

      const balance = tokenDoc.exists
        ? ((tokenDoc.data() as { balance?: number }).balance ?? 0)
        : 0;

      return {
        ...user,
        stats: {
          totalClassrooms: classroomsSnap.size,
          totalSubmissions: submissionsSnap.size,
          balance,
        },
      };
    }

    return { ...user, stats: {} };
  },
};
