import "server-only";
import { adminDb } from "@/server/firebase-admin";
import { Collections } from "@/shared/constants/collections";
import { notFound } from "@/server/utils/errors";

export type ResourceKind = "link" | "doc";

export type ResourceItem = {
  id: string;
  classroomId: string;
  kind: ResourceKind;
  title: string;
  url: string;
  description?: string;
  createdAt: string;
};

export const resourcesService = {
  async list(classroomId: string): Promise<ResourceItem[]> {
    const snap = await adminDb
      .collection(Collections.RESOURCES)
      .where("classroomId", "==", classroomId)
      .get();
    const rows = snap.docs.map(
      (d) => ({ id: d.id, ...(d.data() as Omit<ResourceItem, "id">) }),
    );
    rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return rows;
  },

  async add(args: {
    classroomId: string;
    kind: ResourceKind;
    title: string;
    url: string;
    description?: string;
  }): Promise<ResourceItem> {
    const data: Omit<ResourceItem, "id"> = {
      classroomId: args.classroomId,
      kind: args.kind,
      title: args.title,
      url: args.url,
      description: args.description,
      createdAt: new Date().toISOString(),
    };
    const ref = await adminDb.collection(Collections.RESOURCES).add(data);
    return { id: ref.id, ...data };
  },

  async remove(classroomId: string, itemId: string): Promise<void> {
    const ref = adminDb.collection(Collections.RESOURCES).doc(itemId);
    const doc = await ref.get();
    if (!doc.exists) throw notFound("Resource");
    const data = doc.data() as ResourceItem;
    if (data.classroomId !== classroomId) throw notFound("Resource");
    await ref.delete();
  },
};
