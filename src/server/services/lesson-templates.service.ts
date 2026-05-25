import "server-only";
import { adminDb } from "@/server/firebase-admin";
import { Collections } from "@/shared/constants/collections";
import { agendaService } from "@/server/services/agenda.service";
import { notFound } from "@/server/utils/errors";

export type TemplateItem = {
  title: string;
  description?: string;
  durationMin?: number;
};

export type LessonTemplate = {
  id: string;
  teacherId: string;
  name: string;
  subject?: string;
  items: TemplateItem[];
  createdAt: string;
  updatedAt: string;
};

export const lessonTemplatesService = {
  async list(teacherId: string): Promise<LessonTemplate[]> {
    const snap = await adminDb
      .collection(Collections.LESSON_TEMPLATES)
      .where("teacherId", "==", teacherId)
      .get();
    const items = snap.docs.map(
      (d) => ({ id: d.id, ...(d.data() as Omit<LessonTemplate, "id">) }) as LessonTemplate,
    );
    items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return items;
  },

  async create(
    teacherId: string,
    data: Omit<LessonTemplate, "id" | "teacherId" | "createdAt" | "updatedAt">,
  ): Promise<LessonTemplate> {
    const ref = adminDb.collection(Collections.LESSON_TEMPLATES).doc();
    const now = new Date().toISOString();
    const payload: Omit<LessonTemplate, "id"> = {
      teacherId,
      ...data,
      createdAt: now,
      updatedAt: now,
    };
    await ref.set(payload);
    return { id: ref.id, ...payload };
  },

  async update(
    teacherId: string,
    id: string,
    patch: Partial<Pick<LessonTemplate, "name" | "subject" | "items">>,
  ): Promise<LessonTemplate> {
    const ref = adminDb.collection(Collections.LESSON_TEMPLATES).doc(id);
    const doc = await ref.get();
    if (!doc.exists) throw notFound("Template");
    const data = doc.data() as LessonTemplate;
    if (data.teacherId !== teacherId) throw notFound("Template");
    const merged = { ...patch, updatedAt: new Date().toISOString() };
    await ref.update(merged);
    return { ...data, ...merged, id };
  },

  async remove(teacherId: string, id: string): Promise<void> {
    const ref = adminDb.collection(Collections.LESSON_TEMPLATES).doc(id);
    const doc = await ref.get();
    if (!doc.exists) throw notFound("Template");
    const data = doc.data() as LessonTemplate;
    if (data.teacherId !== teacherId) throw notFound("Template");
    await ref.delete();
  },

  async applyToClassroom(
    teacherId: string,
    id: string,
    classroomId: string,
  ): Promise<{ created: number }> {
    const doc = await adminDb.collection(Collections.LESSON_TEMPLATES).doc(id).get();
    if (!doc.exists) throw notFound("Template");
    const data = doc.data() as LessonTemplate;
    if (data.teacherId !== teacherId) throw notFound("Template");
    let created = 0;
    for (const item of data.items) {
      await agendaService.add({
        classroomId,
        title: item.title,
        description: item.description,
        durationMin: item.durationMin,
      });
      created++;
    }
    return { created };
  },
};
