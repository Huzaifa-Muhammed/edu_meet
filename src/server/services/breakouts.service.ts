import "server-only";
import { adminDb } from "@/server/firebase-admin";
import { Collections } from "@/shared/constants/collections";
import { notFound, badRequest, forbidden } from "@/server/utils/errors";

export type BreakoutRoom = {
  id: string;
  meetingId: string;
  classroomId: string;
  teacherId: string;
  name: string;
  icon: string;
  members: string[]; // student uids
  timerEndsAt: string | null;
  closed: boolean;
  createdAt: string;
  updatedAt: string;
};

type CreateInput = {
  name: string;
  icon?: string;
  members?: string[];
  timerSec?: number;
};

type PatchInput = {
  name?: string;
  icon?: string;
  members?: string[];
  timerSec?: number | null; // explicit null clears the timer
  closed?: boolean;
};

const ROOM_ICONS = ["🧮", "💬", "🎯", "🧪", "📚", "🎨", "🌍", "⚙️"];

async function ensureMeetingTeacher(meetingId: string, uid: string) {
  const m = await adminDb.collection(Collections.MEETINGS).doc(meetingId).get();
  if (!m.exists) throw notFound("Meeting");
  const data = m.data() as { teacherId?: string; classroomId?: string };
  if (data.teacherId !== uid) throw forbidden("Only the host teacher can manage breakouts");
  return { teacherId: data.teacherId, classroomId: data.classroomId ?? "" };
}

export const breakoutsService = {
  async list(meetingId: string): Promise<BreakoutRoom[]> {
    const snap = await adminDb
      .collection(Collections.BREAKOUTS)
      .where("meetingId", "==", meetingId)
      .get();
    const rooms = snap.docs.map(
      (d) => ({ id: d.id, ...(d.data() as Omit<BreakoutRoom, "id">) }),
    );
    rooms.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return rooms;
  },

  async create(meetingId: string, teacherUid: string, input: CreateInput) {
    const meta = await ensureMeetingTeacher(meetingId, teacherUid);
    const name = input.name?.trim();
    if (!name) throw badRequest("Room name is required");

    const existing = await this.list(meetingId);
    const icon =
      input.icon?.trim() || ROOM_ICONS[existing.length % ROOM_ICONS.length];

    const now = new Date().toISOString();
    const timerEndsAt =
      typeof input.timerSec === "number" && input.timerSec > 0
        ? new Date(Date.now() + input.timerSec * 1000).toISOString()
        : null;

    const data: Omit<BreakoutRoom, "id"> = {
      meetingId,
      classroomId: meta.classroomId,
      teacherId: teacherUid,
      name,
      icon,
      members: Array.isArray(input.members) ? input.members.slice(0, 30) : [],
      timerEndsAt,
      closed: false,
      createdAt: now,
      updatedAt: now,
    };
    const ref = await adminDb.collection(Collections.BREAKOUTS).add(data);
    return { id: ref.id, ...data };
  },

  async patch(
    meetingId: string,
    roomId: string,
    teacherUid: string,
    patch: PatchInput,
  ) {
    await ensureMeetingTeacher(meetingId, teacherUid);
    const ref = adminDb.collection(Collections.BREAKOUTS).doc(roomId);
    const cur = await ref.get();
    if (!cur.exists) throw notFound("Breakout room");
    if ((cur.data() as { meetingId?: string }).meetingId !== meetingId) {
      throw badRequest("Room does not belong to this meeting");
    }

    const update: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (typeof patch.name === "string") update.name = patch.name.trim();
    if (typeof patch.icon === "string") update.icon = patch.icon;
    if (Array.isArray(patch.members)) update.members = patch.members.slice(0, 30);
    if (typeof patch.closed === "boolean") update.closed = patch.closed;
    if (patch.timerSec === null) {
      update.timerEndsAt = null;
    } else if (typeof patch.timerSec === "number" && patch.timerSec > 0) {
      update.timerEndsAt = new Date(Date.now() + patch.timerSec * 1000).toISOString();
    }
    await ref.update(update);
    return { id: roomId, ...update };
  },

  async remove(meetingId: string, roomId: string, teacherUid: string) {
    await ensureMeetingTeacher(meetingId, teacherUid);
    const ref = adminDb.collection(Collections.BREAKOUTS).doc(roomId);
    const cur = await ref.get();
    if (!cur.exists) throw notFound("Breakout room");
    if ((cur.data() as { meetingId?: string }).meetingId !== meetingId) {
      throw badRequest("Room does not belong to this meeting");
    }
    await ref.delete();
    return { id: roomId, deleted: true };
  },

  /** Recall every student back to the main room: clear members + close all
   *  rooms for this meeting. Pubsub notification is sent separately by the
   *  route handler. */
  async recallAll(meetingId: string, teacherUid: string) {
    await ensureMeetingTeacher(meetingId, teacherUid);
    const snap = await adminDb
      .collection(Collections.BREAKOUTS)
      .where("meetingId", "==", meetingId)
      .get();
    const now = new Date().toISOString();
    const writes = snap.docs.map((d) =>
      d.ref.update({ members: [], closed: true, timerEndsAt: null, updatedAt: now }),
    );
    await Promise.all(writes);
    return { recalled: snap.size };
  },
};
