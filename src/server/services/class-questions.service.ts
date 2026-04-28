import "server-only";
import { adminDb } from "@/server/firebase-admin";
import { Collections } from "@/shared/constants/collections";
import { notFound } from "@/server/utils/errors";

export type ClassQuestion = {
  id: string;
  classroomId: string;
  meetingId?: string | null;
  text: string;
  askedById: string;
  askedByName: string;
  status: "pending" | "answered" | "dismissed";
  pinned: boolean;
  upvotes: number;
  createdAt: string;
  answeredAt?: string | null;
  aiAnswer?: string | null;
  aiAnsweredAt?: string | null;
};

export const classQuestionsService = {
  async list(classroomId: string): Promise<ClassQuestion[]> {
    // In-memory sort to avoid Firestore composite index requirement.
    const snap = await adminDb
      .collection(Collections.CLASS_QUESTIONS)
      .where("classroomId", "==", classroomId)
      .get();
    const rows = snap.docs.map(
      (d) => ({ id: d.id, ...(d.data() as Omit<ClassQuestion, "id">) }),
    );
    return rows
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .slice(0, 200);
  },

  async add(args: {
    classroomId: string;
    meetingId?: string | null;
    text: string;
    askedById: string;
    askedByName: string;
  }): Promise<ClassQuestion> {
    const data: Omit<ClassQuestion, "id"> = {
      classroomId: args.classroomId,
      meetingId: args.meetingId ?? null,
      text: args.text.trim(),
      askedById: args.askedById,
      askedByName: args.askedByName,
      status: "pending",
      pinned: false,
      upvotes: 0,
      createdAt: new Date().toISOString(),
      answeredAt: null,
      aiAnswer: null,
      aiAnsweredAt: null,
    };
    const ref = await adminDb.collection(Collections.CLASS_QUESTIONS).add(data);
    return { id: ref.id, ...data };
  },

  async update(
    classroomId: string,
    questionId: string,
    patch: Partial<Pick<ClassQuestion, "status" | "pinned" | "aiAnswer">>,
  ): Promise<ClassQuestion> {
    const ref = adminDb.collection(Collections.CLASS_QUESTIONS).doc(questionId);
    const doc = await ref.get();
    if (!doc.exists) throw notFound("Question");
    const data = doc.data();
    if (!data || data.classroomId !== classroomId) throw notFound("Question");

    const update: Record<string, unknown> = { ...patch };
    if (patch.status === "answered" && !data.answeredAt) {
      update.answeredAt = new Date().toISOString();
    }
    if (patch.aiAnswer) {
      update.aiAnsweredAt = new Date().toISOString();
    }
    await ref.update(update);
    const fresh = (await ref.get()).data() as Omit<ClassQuestion, "id">;
    return { id: questionId, ...fresh };
  },

  async remove(classroomId: string, questionId: string): Promise<void> {
    const ref = adminDb.collection(Collections.CLASS_QUESTIONS).doc(questionId);
    const doc = await ref.get();
    if (!doc.exists) throw notFound("Question");
    const data = doc.data();
    if (!data || data.classroomId !== classroomId) throw notFound("Question");
    await ref.delete();
  },
};
