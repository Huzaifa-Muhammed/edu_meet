import "server-only";
import { adminDb } from "@/server/firebase-admin";
import { Collections } from "@/shared/constants/collections";
import { notFound } from "@/server/utils/errors";

export type ClassNote = {
  id: string;
  classroomId: string;
  text: string;
  authorId: string;
  authorName: string;
  authorRole: "teacher" | "admin" | "student";
  createdAt: string;
};

export const classNotesService = {
  async list(classroomId: string): Promise<ClassNote[]> {
    // In-memory sort to avoid Firestore composite index requirement.
    const snap = await adminDb
      .collection(Collections.NOTES)
      .where("classroomId", "==", classroomId)
      .get();
    const rows = snap.docs.map(
      (d) => ({ id: d.id, ...(d.data() as Omit<ClassNote, "id">) }),
    );
    return rows
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .slice(0, 200);
  },

  async add(args: {
    classroomId: string;
    text: string;
    authorId: string;
    authorName: string;
    authorRole: "teacher" | "admin" | "student";
  }): Promise<ClassNote> {
    const data: Omit<ClassNote, "id"> = {
      classroomId: args.classroomId,
      text: args.text.trim(),
      authorId: args.authorId,
      authorName: args.authorName,
      authorRole: args.authorRole,
      createdAt: new Date().toISOString(),
    };
    const ref = await adminDb.collection(Collections.NOTES).add(data);
    return { id: ref.id, ...data };
  },

  async remove(classroomId: string, noteId: string): Promise<void> {
    const ref = adminDb.collection(Collections.NOTES).doc(noteId);
    const doc = await ref.get();
    if (!doc.exists) throw notFound("Note");
    const data = doc.data();
    if (!data || data.classroomId !== classroomId) throw notFound("Note");
    await ref.delete();
  },
};
