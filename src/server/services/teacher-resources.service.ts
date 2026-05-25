import "server-only";
import { adminDb } from "@/server/firebase-admin";
import { Collections } from "@/shared/constants/collections";
import { notFound } from "@/server/utils/errors";

export type TeacherResource = {
  id: string;
  teacherId: string;
  kind: "link" | "image";
  title: string;
  url: string;
  description?: string;
  publicId?: string; // Cloudinary id for image kind
  tags: string[];
  createdAt: string;
};

export const teacherResourcesService = {
  async list(teacherId: string): Promise<TeacherResource[]> {
    const snap = await adminDb
      .collection(Collections.TEACHER_RESOURCES)
      .where("teacherId", "==", teacherId)
      .get();
    const items = snap.docs.map(
      (d) => ({ id: d.id, ...(d.data() as Omit<TeacherResource, "id">) }) as TeacherResource,
    );
    items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return items;
  },

  async create(
    teacherId: string,
    data: Omit<TeacherResource, "id" | "teacherId" | "createdAt">,
  ): Promise<TeacherResource> {
    const ref = adminDb.collection(Collections.TEACHER_RESOURCES).doc();
    const payload: Omit<TeacherResource, "id"> = {
      teacherId,
      ...data,
      createdAt: new Date().toISOString(),
    };
    await ref.set(payload);
    return { id: ref.id, ...payload };
  },

  async remove(teacherId: string, id: string) {
    const ref = adminDb.collection(Collections.TEACHER_RESOURCES).doc(id);
    const doc = await ref.get();
    if (!doc.exists) throw notFound("Resource");
    const data = doc.data() as TeacherResource;
    if (data.teacherId !== teacherId) throw notFound("Resource");
    await ref.delete();
    return { id, publicId: data.publicId };
  },

  /** Copy a resource onto a classroom's public resources list. */
  async pushToClassroom(
    teacherId: string,
    resourceId: string,
    classroomId: string,
  ) {
    const doc = await adminDb
      .collection(Collections.TEACHER_RESOURCES)
      .doc(resourceId)
      .get();
    if (!doc.exists) throw notFound("Resource");
    const data = doc.data() as TeacherResource;
    if (data.teacherId !== teacherId) throw notFound("Resource");
    const target = adminDb.collection(Collections.RESOURCES).doc();
    await target.set({
      classroomId,
      kind: data.kind === "image" ? "doc" : "link",
      title: data.title,
      url: data.url,
      description: data.description ?? null,
      createdAt: new Date().toISOString(),
      createdBy: teacherId,
    });
    return { id: target.id };
  },
};
