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

  async getAttendance(meetingId: string) {
    const snap = await adminDb
      .collection(Collections.ATTENDANCE_EVENTS)
      .where("meetingId", "==", meetingId)
      .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  },
};
