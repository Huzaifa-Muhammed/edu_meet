import "server-only";
import { adminDb } from "@/server/firebase-admin";
import { Collections } from "@/shared/constants/collections";
import { notFound } from "@/server/utils/errors";
import { videosdkService } from "@/server/services/videosdk.service";
import type { MeetingCreateInput } from "@/shared/schemas/meeting.schema";

export const meetingsService = {
  async create(teacherId: string, data: MeetingCreateInput) {
    let videosdkRoomId: string | null = null;
    try {
      videosdkRoomId = await videosdkService.createRoom();
    } catch (err) {
      console.warn("[meetings] videosdk room creation failed (will retry on join):", err);
    }

    const meetingData = {
      classroomId: data.classroomId,
      teacherId,
      videosdkRoomId,
      status: "scheduled" as const,
      startedAt: data.scheduledAt ?? new Date().toISOString(),
      endedAt: null,
      recordingUrl: null,
      currentSlide: null,
      participantIds: [],
    };
    const ref = await adminDb.collection(Collections.MEETINGS).add(meetingData);
    return { id: ref.id, ...meetingData };
  },

  async getById(id: string) {
    const doc = await adminDb.collection(Collections.MEETINGS).doc(id).get();
    if (!doc.exists) throw notFound("Meeting");
    return { id: doc.id, ...doc.data() };
  },

  async getUpcoming(teacherId: string) {
    const snap = await adminDb
      .collection(Collections.MEETINGS)
      .where("teacherId", "==", teacherId)
      .where("status", "in", ["scheduled", "live"])
      .orderBy("startedAt", "asc")
      .limit(20)
      .get();

    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  },

  async getPast(teacherId: string) {
    const snap = await adminDb
      .collection(Collections.MEETINGS)
      .where("teacherId", "==", teacherId)
      .where("status", "==", "ended")
      .orderBy("endedAt", "desc")
      .limit(20)
      .get();

    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  },

  async listForTeacher(teacherId: string) {
    const snap = await adminDb
      .collection(Collections.MEETINGS)
      .where("teacherId", "==", teacherId)
      .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  },

  async markLive(id: string) {
    await adminDb.collection(Collections.MEETINGS).doc(id).update({
      status: "live",
      startedAt: new Date().toISOString(),
    });
    return { id, status: "live" };
  },

  async end(
    meetingId: string,
    input?: { remarks?: string; issues?: string[]; impact?: string },
  ) {
    await adminDb.collection(Collections.MEETINGS).doc(meetingId).update({
      status: "ended",
      endedAt: new Date().toISOString(),
    });

    const hasSummary =
      !!input?.remarks || (input?.issues && input.issues.length > 0) || !!input?.impact;
    if (hasSummary) {
      await adminDb
        .collection(Collections.SUMMARIES)
        .doc(meetingId)
        .set(
          {
            teacherRemarks: input?.remarks ?? "",
            issues: input?.issues ?? [],
            impact: input?.impact ?? "",
            status: "draft",
          },
          { merge: true },
        );
    }

    return { id: meetingId, status: "ended" };
  },

  /**
   * Lazily allocate a videosdk room for a meeting that doesn't have one yet.
   * Safe to call multiple times; will only allocate if current value is falsy.
   */
  async ensureVideosdkRoom(meetingId: string): Promise<string> {
    const ref = adminDb.collection(Collections.MEETINGS).doc(meetingId);
    const doc = await ref.get();
    if (!doc.exists) throw notFound("Meeting");
    const existing = doc.data()?.videosdkRoomId as string | null | undefined;
    if (existing) return existing;

    const roomId = await videosdkService.createRoom();
    await ref.update({ videosdkRoomId: roomId });
    return roomId;
  },

  async addParticipant(meetingId: string, uid: string) {
    const ref = adminDb.collection(Collections.MEETINGS).doc(meetingId);
    const doc = await ref.get();
    if (!doc.exists) throw notFound("Meeting");
    const existing = (doc.data()?.participantIds as string[] | undefined) ?? [];
    if (!existing.includes(uid)) {
      await ref.update({ participantIds: [...existing, uid] });
    }
  },

  async logAttendance(
    meetingId: string,
    uid: string,
    type: "join" | "leave" | "hand" | "mic" | "away" | "attentive",
  ) {
    await adminDb.collection(Collections.ATTENDANCE_EVENTS).add({
      meetingId,
      uid,
      type,
      ts: new Date().toISOString(),
    });
  },

  async kickStudent(meetingId: string, uid: string, teacherUid: string) {
    const { FieldValue } = await import("firebase-admin/firestore");
    const ref = adminDb.collection(Collections.MEETINGS).doc(meetingId);
    const doc = await ref.get();
    if (!doc.exists) throw notFound("Meeting");
    const data = doc.data() ?? {};
    if (data.teacherId !== teacherUid) {
      const { forbidden } = await import("@/server/utils/errors");
      throw forbidden("Only the meeting host can remove students");
    }
    await ref.update({
      bannedUids: FieldValue.arrayUnion(uid),
    });
    return { meetingId, uid, banned: true };
  },

  async unkickStudent(meetingId: string, uid: string, teacherUid: string) {
    const { FieldValue } = await import("firebase-admin/firestore");
    const ref = adminDb.collection(Collections.MEETINGS).doc(meetingId);
    const doc = await ref.get();
    if (!doc.exists) throw notFound("Meeting");
    const data = doc.data() ?? {};
    if (data.teacherId !== teacherUid) {
      const { forbidden } = await import("@/server/utils/errors");
      throw forbidden("Only the meeting host can readmit students");
    }
    await ref.update({
      bannedUids: FieldValue.arrayRemove(uid),
    });
    return { meetingId, uid, banned: false };
  },

  async getAttendance(meetingId: string) {
    const snap = await adminDb
      .collection(Collections.ATTENDANCE_EVENTS)
      .where("meetingId", "==", meetingId)
      .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  },

  /** Banned student files a rejoin request. Idempotent — repeated calls
   *  refresh the timestamp + reset status to pending. Returns the stored
   *  status. Throws notFound if the meeting doesn't exist; returns
   *  status:"not-banned" when the caller wasn't actually banned (so the
   *  student page can fall through and just retry the token endpoint). */
  async requestRejoin(
    meetingId: string,
    uid: string,
    name: string,
    email?: string,
  ) {
    const meetingRef = adminDb.collection(Collections.MEETINGS).doc(meetingId);
    const meeting = await meetingRef.get();
    if (!meeting.exists) throw notFound("Meeting");
    const data = meeting.data() ?? {};
    const banned = (data.bannedUids as string[] | undefined) ?? [];
    if (!banned.includes(uid)) {
      return { meetingId, uid, status: "not-banned" as const };
    }

    const reqId = `${meetingId}_${uid}`;
    const reqRef = adminDb.collection(Collections.REJOIN_REQUESTS).doc(reqId);
    await reqRef.set(
      {
        meetingId,
        uid,
        name,
        email: email ?? null,
        requestedAt: new Date().toISOString(),
        status: "pending",
        processedAt: null,
        processedBy: null,
      },
      { merge: true },
    );
    return { meetingId, uid, status: "pending" as const };
  },

  async getRejoinRequest(meetingId: string, uid: string) {
    const reqId = `${meetingId}_${uid}`;
    const doc = await adminDb
      .collection(Collections.REJOIN_REQUESTS)
      .doc(reqId)
      .get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() };
  },

  async listPendingRejoinRequests(meetingId: string, teacherUid: string) {
    const meeting = await adminDb
      .collection(Collections.MEETINGS)
      .doc(meetingId)
      .get();
    if (!meeting.exists) throw notFound("Meeting");
    const data = meeting.data() ?? {};
    if (data.teacherId !== teacherUid) {
      const { forbidden } = await import("@/server/utils/errors");
      throw forbidden("Only the meeting host can view rejoin requests");
    }

    // Single equality filter avoids needing a composite index. Filter +
    // sort in-memory; per-meeting volume is small.
    const snap = await adminDb
      .collection(Collections.REJOIN_REQUESTS)
      .where("meetingId", "==", meetingId)
      .get();

    type PendingRow = {
      id: string;
      meetingId: string;
      uid: string;
      name: string;
      email?: string | null;
      requestedAt: string;
      status: "pending" | "approved" | "denied";
    };
    const rows = snap.docs.map((d) => {
      const row = d.data() as Omit<PendingRow, "id">;
      return { id: d.id, ...row };
    });
    return rows
      .filter((r) => r.status === "pending")
      .sort((a, b) =>
        String(b.requestedAt ?? "").localeCompare(String(a.requestedAt ?? "")),
      );
  },

  async approveRejoinRequest(
    meetingId: string,
    uid: string,
    teacherUid: string,
  ) {
    const { FieldValue } = await import("firebase-admin/firestore");
    const meetingRef = adminDb.collection(Collections.MEETINGS).doc(meetingId);
    const meeting = await meetingRef.get();
    if (!meeting.exists) throw notFound("Meeting");
    const data = meeting.data() ?? {};
    if (data.teacherId !== teacherUid) {
      const { forbidden } = await import("@/server/utils/errors");
      throw forbidden("Only the meeting host can approve rejoin requests");
    }

    await meetingRef.update({
      bannedUids: FieldValue.arrayRemove(uid),
    });

    const reqId = `${meetingId}_${uid}`;
    await adminDb
      .collection(Collections.REJOIN_REQUESTS)
      .doc(reqId)
      .set(
        {
          status: "approved",
          processedAt: new Date().toISOString(),
          processedBy: teacherUid,
        },
        { merge: true },
      );
    return { meetingId, uid, status: "approved" as const };
  },

  async denyRejoinRequest(
    meetingId: string,
    uid: string,
    teacherUid: string,
  ) {
    const meetingRef = adminDb.collection(Collections.MEETINGS).doc(meetingId);
    const meeting = await meetingRef.get();
    if (!meeting.exists) throw notFound("Meeting");
    const data = meeting.data() ?? {};
    if (data.teacherId !== teacherUid) {
      const { forbidden } = await import("@/server/utils/errors");
      throw forbidden("Only the meeting host can deny rejoin requests");
    }

    const reqId = `${meetingId}_${uid}`;
    await adminDb
      .collection(Collections.REJOIN_REQUESTS)
      .doc(reqId)
      .set(
        {
          status: "denied",
          processedAt: new Date().toISOString(),
          processedBy: teacherUid,
        },
        { merge: true },
      );
    return { meetingId, uid, status: "denied" as const };
  },
};
