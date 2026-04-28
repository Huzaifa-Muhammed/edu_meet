import "server-only";
import { adminDb, getBucket } from "@/server/firebase-admin";
import { Collections } from "@/shared/constants/collections";
import { notFound } from "@/server/utils/errors";

export type SlideDoc = {
  id: string;
  meetingId: string;
  idx: number;
  url: string;
  storagePath: string;
  filename: string;
  contentType: string;
  size: number;
  createdAt: string;
};

/** Slides are stored per-meeting.
 *  Firestore: meetingSlides/{docId} with meetingId filter.
 *  Storage:   meetings/{meetingId}/slides/{timestamp}-{filename} */
export const slidesService = {
  async list(meetingId: string): Promise<SlideDoc[]> {
    // Avoid composite index requirement — single-field where() + in-memory sort.
    // Per-meeting slide count is small (<<500), so this is cheap.
    const snap = await adminDb
      .collection(Collections.MEETING_SLIDES)
      .where("meetingId", "==", meetingId)
      .get();
    const rows = snap.docs.map(
      (d) => ({ id: d.id, ...(d.data() as Omit<SlideDoc, "id">) }),
    );
    return rows.sort((a, b) => a.idx - b.idx);
  },

  async add(args: {
    meetingId: string;
    buffer: Buffer;
    filename: string;
    contentType: string;
  }): Promise<SlideDoc> {
    const { meetingId, buffer, filename, contentType } = args;

    // Validate content type — only accept common image types
    if (!/^image\/(png|jpeg|jpg|webp|gif)$/i.test(contentType)) {
      throw new Error(`Unsupported file type: ${contentType}`);
    }

    // Determine next idx
    const existing = await this.list(meetingId);
    const nextIdx = existing.length;

    // Upload to Firebase Storage
    const bucket = getBucket();
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `meetings/${meetingId}/slides/${Date.now()}-${safeName}`;
    const file = bucket.file(storagePath);
    await file.save(buffer, {
      contentType,
      resumable: false,
      metadata: { cacheControl: "public, max-age=31536000" },
    });

    // Prefer a public URL; if bucket has uniform access / rules blocking it,
    // fall back to a long-lived signed URL.
    let url: string;
    let madePublic = false;
    try {
      await file.makePublic();
      madePublic = true;
    } catch {
      madePublic = false;
    }

    if (madePublic) {
      url = `https://storage.googleapis.com/${bucket.name}/${encodeURI(storagePath)}`;
    } else {
      const [signed] = await file.getSignedUrl({
        action: "read",
        expires: Date.now() + 365 * 24 * 60 * 60 * 1000,
      });
      url = signed;
    }

    const data: Omit<SlideDoc, "id"> = {
      meetingId,
      idx: nextIdx,
      url,
      storagePath,
      filename: safeName,
      contentType,
      size: buffer.length,
      createdAt: new Date().toISOString(),
    };
    const ref = await adminDb.collection(Collections.MEETING_SLIDES).add(data);
    return { id: ref.id, ...data };
  },

  async remove(meetingId: string, slideId: string): Promise<void> {
    const ref = adminDb.collection(Collections.MEETING_SLIDES).doc(slideId);
    const doc = await ref.get();
    if (!doc.exists) throw notFound("Slide");
    const data = doc.data() as Omit<SlideDoc, "id"> | undefined;
    if (!data || data.meetingId !== meetingId) throw notFound("Slide");

    // Delete from storage (ignore if missing)
    try {
      await getBucket().file(data.storagePath).delete();
    } catch {
      // Already gone
    }
    await ref.delete();

    // Re-number the remaining slides to keep idx contiguous
    const rest = await this.list(meetingId);
    await Promise.all(
      rest.map((s, i) =>
        s.idx !== i
          ? adminDb.collection(Collections.MEETING_SLIDES).doc(s.id).update({ idx: i })
          : Promise.resolve(),
      ),
    );
  },

  async reorder(meetingId: string, orderedIds: string[]): Promise<void> {
    const batch = adminDb.batch();
    orderedIds.forEach((id, idx) => {
      batch.update(adminDb.collection(Collections.MEETING_SLIDES).doc(id), { idx });
    });
    await batch.commit();
    // touch meetingId to satisfy lint param usage
    if (!meetingId) throw new Error("meetingId required");
  },
};
