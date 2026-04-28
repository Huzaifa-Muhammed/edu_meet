import "server-only";
import { adminDb } from "@/server/firebase-admin";
import { Collections } from "@/shared/constants/collections";

export type ChatMessage = {
  id: string;
  classroomId: string;
  meetingId?: string | null;
  text: string;
  senderId: string;
  senderName: string;
  senderRole: "teacher" | "student" | "admin";
  /** Client-supplied dedup key — matches the id used in the pubsub broadcast
   *  so the sender can drop their own optimistic message when the server-
   *  persisted copy comes back. */
  clientId?: string;
  createdAt: string;
};

export const classChatService = {
  async list(
    classroomId: string,
    opts?: { limit?: number },
  ): Promise<ChatMessage[]> {
    const limit = opts?.limit ?? 500;
    // In-memory sort to avoid Firestore composite index requirement.
    const snap = await adminDb
      .collection(Collections.CHATS)
      .where("classroomId", "==", classroomId)
      .get();
    const rows = snap.docs.map(
      (d) => ({ id: d.id, ...(d.data() as Omit<ChatMessage, "id">) }),
    );
    return rows
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
      .slice(-limit);
  },

  async add(args: {
    classroomId: string;
    meetingId?: string | null;
    text: string;
    clientId?: string;
    senderId: string;
    senderName: string;
    senderRole: "teacher" | "student" | "admin";
  }): Promise<ChatMessage> {
    const data: Omit<ChatMessage, "id"> = {
      classroomId: args.classroomId,
      meetingId: args.meetingId ?? null,
      text: args.text.trim(),
      clientId: args.clientId,
      senderId: args.senderId,
      senderName: args.senderName,
      senderRole: args.senderRole,
      createdAt: new Date().toISOString(),
    };
    // Firestore rejects undefined values, so omit clientId if not provided.
    if (!data.clientId) delete (data as Partial<ChatMessage>).clientId;
    const ref = await adminDb.collection(Collections.CHATS).add(data);
    return { id: ref.id, ...data };
  },
};
