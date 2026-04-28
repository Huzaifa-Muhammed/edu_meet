import "server-only";
import { adminDb } from "@/server/firebase-admin";
import { Collections } from "@/shared/constants/collections";
import { notFound } from "@/server/utils/errors";
import type { UserUpdateInput } from "@/shared/schemas/user.schema";

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
};
