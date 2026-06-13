import "server-only";
import { adminDb } from "@/server/firebase-admin";
import { Collections } from "@/shared/constants/collections";
import { notFound } from "@/server/utils/errors";
import { videosdkService } from "@/server/services/videosdk.service";
import { slidesService } from "@/server/services/slides.service";
import type { MeetingCreateInput } from "@/shared/schemas/meeting.schema";

export type TranscriptSegment = { id: string; text: string; ts: number; name?: string };

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

  /** Reassign a meeting to a substitute teacher (admin cover for leave).
   *  Preserves the original teacher so it can be reverted/audited. */
  async reassignTeacher(meetingId: string, newTeacherId: string, byUid: string) {
    const ref = adminDb.collection(Collections.MEETINGS).doc(meetingId);
    const doc = await ref.get();
    if (!doc.exists) throw notFound("Meeting");
    const data = doc.data() ?? {};
    const originalTeacherId =
      (data.originalTeacherId as string | undefined) ?? (data.teacherId as string);
    await ref.update({
      teacherId: newTeacherId,
      originalTeacherId,
      substituteTeacherId: newTeacherId,
      reassignedAt: new Date().toISOString(),
      reassignedBy: byUid,
    });
    return { id: meetingId, teacherId: newTeacherId, originalTeacherId };
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

    // Slides are re-derivable from their source document, so free the Cloudinary
    // space once the class is over. Best-effort — never block ending the class.
    try {
      await slidesService.purgeForMeeting(meetingId);
    } catch {
      // ignore — cleanup can be retried, but a class must always be able to end
    }

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
    durationMs?: number,
  ) {
    const now = new Date().toISOString();
    await adminDb.collection(Collections.ATTENDANCE_EVENTS).add({
      meetingId,
      uid,
      type,
      durationMs: durationMs ?? null,
      ts: now,
    });

    if (type === "away" || type === "attentive") {
      const { FieldValue } = await import("firebase-admin/firestore");
      const partRef = adminDb
        .collection(Collections.MEETINGS)
        .doc(meetingId)
        .collection("participation")
        .doc(uid);

      if (type === "away") {
        const snap = await partRef.get();
        const update: Record<string, unknown> = {
          uid,
          meetingId,
          awayCount: FieldValue.increment(1),
          lastAwayAt: now,
        };
        if (!snap.exists || !snap.data()?.firstAwayAt) {
          update.firstAwayAt = now;
        }
        await partRef.set(update, { merge: true });
      } else {
        const seconds = Math.max(0, Math.round((durationMs ?? 0) / 1000));
        await partRef.set(
          {
            uid,
            meetingId,
            awaySeconds: FieldValue.increment(seconds),
            lastReturnedAt: now,
          },
          { merge: true },
        );
      }
    }
  },

  async getParticipation(meetingId: string, uid: string) {
    const doc = await adminDb
      .collection(Collections.MEETINGS)
      .doc(meetingId)
      .collection("participation")
      .doc(uid)
      .get();
    if (!doc.exists) {
      return {
        awayCount: 0,
        awaySeconds: 0,
        firstAwayAt: null as string | null,
        lastAwayAt: null as string | null,
        lastReturnedAt: null as string | null,
      };
    }
    const data = doc.data() ?? {};
    return {
      awayCount: (data.awayCount as number | undefined) ?? 0,
      awaySeconds: (data.awaySeconds as number | undefined) ?? 0,
      firstAwayAt: (data.firstAwayAt as string | undefined) ?? null,
      lastAwayAt: (data.lastAwayAt as string | undefined) ?? null,
      lastReturnedAt: (data.lastReturnedAt as string | undefined) ?? null,
    };
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

  /** Append a batch of finalised caption segments to the meeting transcript.
   *  Single writer (the host's browser) flushes batches periodically, so
   *  arrayUnion is safe — each segment carries a unique id so no two distinct
   *  utterances are ever deduped away. The doc is keyed by meetingId so every
   *  participant reads the same canonical transcript regardless of join time. */
  async appendTranscript(
    meetingId: string,
    segments: { id: string; text: string; ts: number; name?: string }[],
  ) {
    if (segments.length === 0) return { id: meetingId, added: 0 };
    const { FieldValue } = await import("firebase-admin/firestore");
    await adminDb
      .collection(Collections.TRANSCRIPTS)
      .doc(meetingId)
      .set(
        {
          meetingId,
          segments: FieldValue.arrayUnion(...segments),
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      );
    return { id: meetingId, added: segments.length };
  },

  async getTranscript(meetingId: string) {
    const doc = await adminDb
      .collection(Collections.TRANSCRIPTS)
      .doc(meetingId)
      .get();
    if (!doc.exists) return { meetingId, segments: [] as TranscriptSegment[] };
    const data = doc.data() ?? {};
    const segments = ((data.segments as TranscriptSegment[] | undefined) ?? [])
      .slice()
      .sort((a, b) => (a.ts ?? 0) - (b.ts ?? 0));
    return { meetingId, segments };
  },

  async getAttendance(meetingId: string) {
    const snap = await adminDb
      .collection(Collections.ATTENDANCE_EVENTS)
      .where("meetingId", "==", meetingId)
      .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  },

  /** Real end-of-class insights from persisted data: elapsed duration,
   *  attendance vs enrolment, and questions asked/answered this session.
   *  (Comprehension/participation come from live in-room pubsub signals which
   *  aren't persisted server-side — those are computed client-side and merged
   *  into the wrap-up modal.) */
  async getInsights(meetingId: string) {
    const mDoc = await adminDb
      .collection(Collections.MEETINGS)
      .doc(meetingId)
      .get();
    if (!mDoc.exists) throw notFound("Meeting");
    const m = mDoc.data() ?? {};
    const classroomId = m.classroomId as string;
    const teacherId = m.teacherId as string | undefined;

    const [classDoc, attendance, qSnap] = await Promise.all([
      adminDb.collection(Collections.CLASSROOMS).doc(classroomId).get(),
      this.getAttendance(meetingId),
      adminDb
        .collection(Collections.CLASS_QUESTIONS)
        .where("classroomId", "==", classroomId)
        .get(),
    ]);

    const enrolled =
      ((classDoc.data()?.studentIds as string[] | undefined) ?? []).length;

    // Distinct students who joined (self-reported attendance events).
    const joinUids = new Set<string>();
    for (const e of attendance as { uid?: string; type?: string }[]) {
      if (e.type === "join" && e.uid) joinUids.add(e.uid);
    }
    let attended = joinUids.size;
    if (attended === 0) {
      // Fall back to the participant roster (excluding the host) if no
      // attendance events were logged.
      attended = ((m.participantIds as string[] | undefined) ?? []).filter(
        (u) => u !== teacherId,
      ).length;
    }

    // Questions asked during THIS session (carry meetingId when asked live).
    const qs = qSnap.docs.map(
      (d) =>
        d.data() as {
          meetingId?: string | null;
          status?: string;
          aiAnswer?: string | null;
        },
    );
    const mine = qs.filter((q) => q.meetingId === meetingId);
    const questions = mine.length;
    const questionsAnswered = mine.filter(
      (q) => q.status === "answered" || !!q.aiAnswer,
    ).length;

    const startMs = m.startedAt ? Date.parse(m.startedAt as string) : NaN;
    const endMs = m.endedAt ? Date.parse(m.endedAt as string) : Date.now();
    const durationMin = Number.isFinite(startMs)
      ? Math.max(0, Math.round((endMs - startMs) / 60000))
      : null;

    return { durationMin, attended, enrolled, questions, questionsAnswered };
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
