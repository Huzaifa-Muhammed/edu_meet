import "server-only";
import { adminDb } from "@/server/firebase-admin";
import { Collections } from "@/shared/constants/collections";
import { notFound } from "@/server/utils/errors";

export type AgendaItem = {
  id: string;
  classroomId: string;
  title: string;
  description?: string;
  durationMin?: number;
  done: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
};

/** Agenda is stored as `classroomAgendas/{docId}` keyed by classroomId. */
export const agendaService = {
  async list(classroomId: string): Promise<AgendaItem[]> {
    const snap = await adminDb
      .collection(Collections.CLASSROOM_AGENDAS)
      .where("classroomId", "==", classroomId)
      .get();
    const rows = snap.docs.map(
      (d) => ({ id: d.id, ...(d.data() as Omit<AgendaItem, "id">) }),
    );
    return rows.sort((a, b) => a.order - b.order);
  },

  async add(args: {
    classroomId: string;
    title: string;
    description?: string;
    durationMin?: number;
  }): Promise<AgendaItem> {
    const existing = await this.list(args.classroomId);
    const now = new Date().toISOString();
    const data: Omit<AgendaItem, "id"> = {
      classroomId: args.classroomId,
      title: args.title,
      description: args.description,
      durationMin: args.durationMin,
      done: false,
      order: existing.length,
      createdAt: now,
      updatedAt: now,
    };
    const ref = await adminDb.collection(Collections.CLASSROOM_AGENDAS).add(data);
    return { id: ref.id, ...data };
  },

  async update(
    classroomId: string,
    itemId: string,
    patch: Partial<Pick<AgendaItem, "title" | "description" | "durationMin" | "done" | "order">>,
  ): Promise<AgendaItem> {
    const ref = adminDb.collection(Collections.CLASSROOM_AGENDAS).doc(itemId);
    const doc = await ref.get();
    if (!doc.exists) throw notFound("Agenda item");
    const data = doc.data() as AgendaItem;
    if (data.classroomId !== classroomId) throw notFound("Agenda item");
    const merged = { ...patch, updatedAt: new Date().toISOString() };
    await ref.update(merged);
    return { ...data, ...merged, id: itemId };
  },

  async remove(classroomId: string, itemId: string): Promise<void> {
    const ref = adminDb.collection(Collections.CLASSROOM_AGENDAS).doc(itemId);
    const doc = await ref.get();
    if (!doc.exists) throw notFound("Agenda item");
    const data = doc.data() as AgendaItem;
    if (data.classroomId !== classroomId) throw notFound("Agenda item");
    await ref.delete();

    // Re-number
    const rest = await this.list(classroomId);
    await Promise.all(
      rest.map((r, i) =>
        r.order !== i
          ? adminDb.collection(Collections.CLASSROOM_AGENDAS).doc(r.id).update({ order: i })
          : Promise.resolve(),
      ),
    );
  },
};
