import "server-only";
import { adminDb } from "@/server/firebase-admin";
import { Collections } from "@/shared/constants/collections";
import { notFound, badRequest } from "@/server/utils/errors";
import { uploadImageBuffer, destroyImage } from "@/server/providers/cloudinary";

export type SlideDoc = {
  id: string;
  meetingId: string;
  idx: number;
  url: string;
  /** Cloudinary public id (used for deletion). Legacy docs may hold a Firebase
   *  Storage path instead — `remove` tolerates both. */
  publicId: string;
  filename: string;
  contentType: string;
  size: number;
  createdAt: string;
};

/** Slides are stored per-meeting.
 *  Firestore: meetingSlides/{docId} with meetingId filter.
 *  Images:    Cloudinary under meetings/{meetingId}/slides/ (Firebase Storage is
 *             a paid add-on and isn't provisioned for this project). */
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

    // Upload the image to Cloudinary.
    let url: string;
    let publicId: string;
    try {
      const up = await uploadImageBuffer(buffer, {
        folder: `meetings/${meetingId}/slides`,
        filename,
      });
      url = up.url;
      publicId = up.publicId;
    } catch (e) {
      // Surface the real cause instead of a generic 500.
      const msg = e instanceof Error ? e.message : String(e);
      throw badRequest(`Couldn't save slide image: ${msg}`);
    }

    const data: Omit<SlideDoc, "id"> = {
      meetingId,
      idx: nextIdx,
      url,
      publicId,
      filename: filename.replace(/[^a-zA-Z0-9._-]/g, "_"),
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
    const data = doc.data() as
      | (Omit<SlideDoc, "id"> & { storagePath?: string })
      | undefined;
    if (!data || data.meetingId !== meetingId) throw notFound("Slide");

    // Delete the Cloudinary asset (ignore if already gone). Legacy Firebase
    // Storage docs carried `storagePath` instead of `publicId` — nothing to do
    // for those here.
    if (data.publicId) {
      try {
        await destroyImage(data.publicId);
      } catch {
        // Already gone / not a Cloudinary asset.
      }
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

  /** Delete every slide for a meeting — Cloudinary assets + Firestore docs.
   *  Called when a class ends (slides are always re-derivable from the source
   *  document, so there's no reason to keep them parked on the CDN). Best-effort
   *  and idempotent; returns the number of slide docs removed. */
  async purgeForMeeting(meetingId: string): Promise<number> {
    const slides = await this.list(meetingId);
    if (slides.length === 0) return 0;

    // Drop the Cloudinary assets (ignore individual failures).
    await Promise.all(
      slides.map((s) =>
        s.publicId
          ? destroyImage(s.publicId).catch(() => undefined)
          : Promise.resolve(),
      ),
    );

    // Drop the Firestore docs.
    const batch = adminDb.batch();
    for (const s of slides) {
      batch.delete(adminDb.collection(Collections.MEETING_SLIDES).doc(s.id));
    }
    await batch.commit();
    return slides.length;
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
