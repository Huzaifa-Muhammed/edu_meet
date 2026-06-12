import "server-only";
import { adminDb } from "@/server/firebase-admin";
import { Collections } from "@/shared/constants/collections";

/** One course document (a topic with a Drive link), parsed from the admin's
 *  uploaded Excel sheet. Columns map: Topic / Grade / syllabus / Link. */
export type CourseContentItem = {
  topic: string;
  grade?: string;
  syllabus?: string;
  link: string;
};

/** One subject's worth of course content. Doc id = subjectKey, so a re-upload
 *  for the same subject replaces the previous set. */
export type CourseContent = {
  subjectKey: string;
  subjectId?: string;
  subjectName: string;
  fileName?: string;
  items: CourseContentItem[];
  itemCount: number;
  uploadedBy?: string;
  updatedAt: string;
};

/** Normalise a subject id/name into a stable key for matching + doc id. */
export function subjectKey(s: string): string {
  return (s ?? "").trim().toLowerCase().replace(/\s+/g, "-");
}

export const courseContentService = {
  /** Replace (upsert) the content set for a subject. Doc id = subjectKey. */
  async upsert(args: {
    subjectId?: string;
    subjectName: string;
    fileName?: string;
    items: CourseContentItem[];
    uploadedBy?: string;
  }): Promise<CourseContent> {
    const key = subjectKey(args.subjectId || args.subjectName);
    const data: CourseContent = {
      subjectKey: key,
      subjectId: args.subjectId ?? "",
      subjectName: args.subjectName,
      fileName: args.fileName ?? "",
      items: args.items,
      itemCount: args.items.length,
      uploadedBy: args.uploadedBy ?? "",
      updatedAt: new Date().toISOString(),
    };
    await adminDb
      .collection(Collections.COURSE_CONTENT)
      .doc(key)
      .set(data, { merge: false });
    return data;
  },

  async listAll(): Promise<CourseContent[]> {
    const snap = await adminDb.collection(Collections.COURSE_CONTENT).get();
    return snap.docs
      .map((d) => d.data() as CourseContent)
      .sort((a, b) => a.subjectName.localeCompare(b.subjectName));
  },

  async getByKey(key: string): Promise<CourseContent | null> {
    const doc = await adminDb
      .collection(Collections.COURSE_CONTENT)
      .doc(subjectKey(key))
      .get();
    return doc.exists ? (doc.data() as CourseContent) : null;
  },

  /** Resolve the content for a classroom's subject. Tries the subjectId key,
   *  then the subjectName key, then a normalised-name scan as a last resort. */
  async getForSubject(
    subjectId: string | undefined,
    subjectName: string | undefined,
  ): Promise<CourseContent | null> {
    for (const candidate of [subjectId, subjectName]) {
      if (!candidate) continue;
      const hit = await this.getByKey(candidate);
      if (hit) return hit;
    }
    if (subjectName) {
      const want = subjectKey(subjectName);
      const all = await this.listAll();
      const match = all.find(
        (c) => subjectKey(c.subjectName) === want || c.subjectKey === want,
      );
      if (match) return match;
    }
    return null;
  },

  async remove(key: string): Promise<void> {
    await adminDb
      .collection(Collections.COURSE_CONTENT)
      .doc(subjectKey(key))
      .delete();
  },
};
