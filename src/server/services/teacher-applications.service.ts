import "server-only";
import { adminDb } from "@/server/firebase-admin";
import { Collections } from "@/shared/constants/collections";
import { notFound } from "@/server/utils/errors";
import { sendEmail } from "@/server/providers/email";
import { TeacherApprovedEmail } from "@/server/email/templates/teacher-approved";
import { TeacherRejectedEmail } from "@/server/email/templates/teacher-rejected";
import type { TeacherApplication } from "@/shared/types/domain";
import type {
  TeacherApplicationCreateInput,
  TeacherApplicationReviewInput,
} from "@/shared/schemas/teacher-application.schema";

function appBaseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";
}

const col = () => adminDb.collection(Collections.TEACHER_APPLICATIONS);

export const teacherApplicationsService = {
  async getByUid(uid: string): Promise<TeacherApplication | null> {
    const snap = await col().where("uid", "==", uid).limit(1).get();
    if (snap.empty) return null;
    const doc = snap.docs[0];
    return { id: doc.id, ...(doc.data() as Omit<TeacherApplication, "id">) };
  },

  async listAll(status?: "pending" | "approved" | "rejected") {
    let q: FirebaseFirestore.Query = col();
    if (status) q = q.where("status", "==", status);
    const snap = await q.get();
    const items = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<TeacherApplication, "id">),
    })) as TeacherApplication[];
    items.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
    return items;
  },

  async submit(
    uid: string,
    email: string,
    displayName: string,
    input: TeacherApplicationCreateInput,
  ) {
    const existing = await teacherApplicationsService.getByUid(uid);
    const payload = {
      uid,
      email,
      displayName,
      ...input,
      experiences: input.experiences ?? [],
      certifications: input.certifications ?? [],
      degrees: input.degrees ?? [],
      status: "pending" as const,
      submittedAt: new Date().toISOString(),
      reviewedAt: null,
      reviewedBy: null,
      reviewNote: null,
    };

    if (existing) {
      await col().doc(existing.id).set(payload, { merge: true });
      await adminDb.collection(Collections.USERS).doc(uid).set(
        { applicationStatus: "pending", updatedAt: payload.submittedAt },
        { merge: true },
      );
      return { id: existing.id, ...payload } as unknown as TeacherApplication;
    }

    const ref = await col().add(payload);
    await adminDb.collection(Collections.USERS).doc(uid).set(
      { applicationStatus: "pending", updatedAt: payload.submittedAt },
      { merge: true },
    );
    return { id: ref.id, ...payload } as unknown as TeacherApplication;
  },

  async review(
    id: string,
    reviewerUid: string,
    input: TeacherApplicationReviewInput,
  ) {
    const ref = col().doc(id);
    const snap = await ref.get();
    if (!snap.exists) throw notFound("Teacher application");
    const app = snap.data() as TeacherApplication;

    const reviewedAt = new Date().toISOString();
    await ref.update({
      status: input.status,
      reviewedAt,
      reviewedBy: reviewerUid,
      reviewNote: input.reviewNote ?? null,
    });

    const userPatch: Record<string, unknown> = {
      applicationStatus: input.status,
      updatedAt: reviewedAt,
    };
    if (input.status === "approved") {
      userPatch.experiences = app.experiences ?? [];
      userPatch.certifications = app.certifications ?? [];
      userPatch.degrees = app.degrees ?? [];
      if (app.bio && !("bio" in userPatch)) userPatch.bio = app.bio;
    }

    await adminDb
      .collection(Collections.USERS)
      .doc(app.uid)
      .set(userPatch, { merge: true });

    // Fire-and-forget transactional email. Errors are swallowed by sendEmail.
    const base = appBaseUrl();
    if (input.status === "approved") {
      sendEmail({
        to: app.email,
        subject: "Your EduMeet teacher application is approved",
        templateKey: "teacher-approved",
        react: TeacherApprovedEmail({
          name: app.displayName,
          loginUrl: `${base}/teacher/dashboard`,
          customMessage: input.reviewNote,
        }),
      }).catch((err) => console.error("[email]", err));
    } else if (input.status === "rejected") {
      sendEmail({
        to: app.email,
        subject: "Update on your EduMeet teacher application",
        templateKey: "teacher-rejected",
        react: TeacherRejectedEmail({
          name: app.displayName,
          reapplyUrl: `${base}/teacher/apply`,
          reviewNote: input.reviewNote,
        }),
      }).catch((err) => console.error("[email]", err));
    }

    return { id, status: input.status, reviewedAt };
  },
};
