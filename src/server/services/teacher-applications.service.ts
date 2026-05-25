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

/**
 * Teacher applications live ON THE USER DOC — no separate collection.
 * The admin "applications" list is a query over `users` where
 * `role == teacher`, filtered by `applicationStatus`. Application-specific
 * fields are prefixed `application*` on the user doc.
 *
 * This service assembles a `TeacherApplication`-shaped view so callers
 * (admin pages, email templates) don't change. `application.id === uid`.
 */

type UserDoc = {
  uid?: string;
  email?: string;
  /** Modern field — what our auth/session writes for new users. */
  displayName?: string;
  /** Legacy field — some Firestore docs (manually created / external)
   * only set `name` instead of `displayName`. Read both. */
  name?: string;
  bio?: string;
  /** Canonical application-status field. */
  status?: "none" | "pending" | "approved" | "rejected";
  /** Legacy alias — older code wrote this. Read both, write only `status`. */
  applicationStatus?: "none" | "pending" | "approved" | "rejected";
  applicationSubject?: string;
  applicationYearsExperience?: number;
  applicationHighestDegree?: string;
  applicationSubmittedAt?: string;
  applicationReviewedAt?: string;
  applicationReviewedBy?: string;
  applicationReviewNote?: string;
  experiences?: TeacherApplication["experiences"];
  certifications?: TeacherApplication["certifications"];
  degrees?: TeacherApplication["degrees"];
  /** Legacy bucket — externally-created teacher docs sometimes carry
   * application data under `extraData` rather than top-level. Honored
   * read-only as a graceful fallback. */
  extraData?: {
    bio?: string;
    designation?: string;
    qualification?: string;
    experience?: string;
    specializations?: string[];
  };
};

/** Status normalised across legacy + canonical field names. */
function readStatus(u: UserDoc): UserDoc["status"] {
  return u.status ?? u.applicationStatus;
}

function userDocToApplication(uid: string, u: UserDoc): TeacherApplication | null {
  const status = readStatus(u);
  if (!status || status === "none") return null;
  const displayName = u.displayName ?? u.name ?? "";
  const bio = u.bio ?? u.extraData?.bio;
  const subject =
    u.applicationSubject ??
    u.extraData?.specializations?.[0] ??
    u.extraData?.designation ??
    "";
  const highestDegree =
    u.applicationHighestDegree ?? u.extraData?.qualification ?? "";
  // legacy stores experience as a range string ("1-3yrs"); take the leading
  // integer if we can, else 0
  const yearsExperience =
    u.applicationYearsExperience ??
    (() => {
      const raw = u.extraData?.experience;
      if (!raw) return 0;
      const m = raw.match(/\d+/);
      return m ? Number(m[0]) : 0;
    })();
  return {
    id: uid,
    uid,
    email: u.email ?? "",
    displayName,
    subject,
    yearsExperience,
    highestDegree,
    bio,
    experiences: u.experiences,
    certifications: u.certifications,
    degrees: u.degrees,
    status: status as "pending" | "approved" | "rejected",
    submittedAt: u.applicationSubmittedAt ?? new Date(0).toISOString(),
    reviewedAt: u.applicationReviewedAt,
    reviewedBy: u.applicationReviewedBy,
    reviewNote: u.applicationReviewNote,
  };
}

export const teacherApplicationsService = {
  async getByUid(uid: string): Promise<TeacherApplication | null> {
    const doc = await adminDb.collection(Collections.USERS).doc(uid).get();
    if (!doc.exists) return null;
    return userDocToApplication(uid, doc.data() as UserDoc);
  },

  async listAll(
    status?: "pending" | "approved" | "rejected",
  ): Promise<TeacherApplication[]> {
    // Query by role only — the status filter is applied in-memory so we
    // can handle both `status` and `applicationStatus` field names
    // (Firestore can't OR across two fields without two queries + dedupe).
    const snap = await adminDb
      .collection(Collections.USERS)
      .where("role", "==", "teacher")
      .get();
    const items: TeacherApplication[] = [];
    for (const d of snap.docs) {
      const u = d.data() as UserDoc;
      const effectiveStatus = readStatus(u);
      if (status && effectiveStatus !== status) continue;
      const view = userDocToApplication(d.id, u);
      if (view) items.push(view);
    }
    items.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
    return items;
  },

  async submit(
    uid: string,
    email: string,
    displayName: string,
    input: TeacherApplicationCreateInput,
  ): Promise<TeacherApplication> {
    const submittedAt = new Date().toISOString();
    const patch = {
      // Keep core profile fields fresh (don't overwrite if already different).
      // We mirror displayName→name so the legacy `name` reader still works.
      email,
      displayName,
      name: displayName,

      // Application data, all on the user doc. `status` is canonical;
      // `applicationStatus` is mirrored for any reader still looking at it.
      status: "pending" as const,
      applicationStatus: "pending" as const,
      applicationSubject: input.subject,
      applicationYearsExperience: input.yearsExperience,
      applicationHighestDegree: input.highestDegree,
      applicationSubmittedAt: submittedAt,
      // Reset review fields on (re)submit — admin will fill them next round
      applicationReviewedAt: null,
      applicationReviewedBy: null,
      applicationReviewNote: null,

      // Credential evidence (also used by the user profile on approval)
      bio: input.bio,
      experiences: input.experiences ?? [],
      certifications: input.certifications ?? [],
      degrees: input.degrees ?? [],

      updatedAt: submittedAt,
    };

    await adminDb
      .collection(Collections.USERS)
      .doc(uid)
      .set(patch, { merge: true });

    const view = userDocToApplication(uid, {
      ...patch,
      status: "pending",
      applicationStatus: "pending",
      applicationReviewedAt: undefined,
      applicationReviewedBy: undefined,
      applicationReviewNote: undefined,
    } as UserDoc);
    return view!;
  },

  async review(
    uid: string,
    reviewerUid: string,
    input: TeacherApplicationReviewInput,
  ) {
    const userRef = adminDb.collection(Collections.USERS).doc(uid);
    const snap = await userRef.get();
    if (!snap.exists) throw notFound("Teacher");
    const u = snap.data() as UserDoc;
    // Allow re-review of already-approved/rejected teachers too — admin
    // might want to revoke. No precondition.

    const reviewedAt = new Date().toISOString();
    await userRef.set(
      {
        status: input.status,
        applicationStatus: input.status, // mirrored for legacy readers
        applicationReviewedAt: reviewedAt,
        applicationReviewedBy: reviewerUid,
        applicationReviewNote: input.reviewNote ?? null,
        updatedAt: reviewedAt,
      },
      { merge: true },
    );

    // Fire-and-forget transactional email. Errors are swallowed by sendEmail.
    const base = appBaseUrl();
    const name = u.displayName ?? u.name ?? "";
    const to = u.email ?? "";
    if (to) {
      if (input.status === "approved") {
        sendEmail({
          to,
          subject: "Your EduMeet teacher application is approved",
          templateKey: "teacher-approved",
          react: TeacherApprovedEmail({
            name,
            loginUrl: `${base}/teacher/dashboard`,
            customMessage: input.reviewNote,
          }),
        }).catch((err) => console.error("[email]", err));
      } else if (input.status === "rejected") {
        sendEmail({
          to,
          subject: "Update on your EduMeet teacher application",
          templateKey: "teacher-rejected",
          react: TeacherRejectedEmail({
            name,
            reapplyUrl: `${base}/teacher/apply`,
            reviewNote: input.reviewNote,
          }),
        }).catch((err) => console.error("[email]", err));
      }
    }

    return { id: uid, status: input.status, reviewedAt };
  },

  /**
   * One-time migration: copy historical teacherApplications/* docs onto the
   * matching user docs. Safe to run multiple times — only writes when the
   * user doc is missing the application fields. Returns counts so an admin
   * can verify before retiring the old collection.
   */
  async migrateFromLegacyCollection(): Promise<{
    scanned: number;
    migrated: number;
    skipped: number;
  }> {
    let scanned = 0;
    let migrated = 0;
    let skipped = 0;
    const snap = await adminDb
      .collection(Collections.TEACHER_APPLICATIONS)
      .get();
    for (const d of snap.docs) {
      scanned++;
      const a = d.data() as {
        uid?: string;
        email?: string;
        displayName?: string;
        subject?: string;
        yearsExperience?: number;
        highestDegree?: string;
        bio?: string;
        experiences?: TeacherApplication["experiences"];
        certifications?: TeacherApplication["certifications"];
        degrees?: TeacherApplication["degrees"];
        status?: "pending" | "approved" | "rejected";
        submittedAt?: string;
        reviewedAt?: string;
        reviewedBy?: string;
        reviewNote?: string;
      };
      if (!a.uid) {
        skipped++;
        continue;
      }
      const userRef = adminDb.collection(Collections.USERS).doc(a.uid);
      const userDoc = await userRef.get();
      if (!userDoc.exists) {
        skipped++;
        continue;
      }
      const u = userDoc.data() as UserDoc;
      // Only fill in missing application fields — never overwrite a fresh
      // submission. We pick the legacy data only when the user doc has no
      // application data at all.
      if (u.applicationSubject || u.applicationSubmittedAt) {
        skipped++;
        continue;
      }
      await userRef.set(
        {
          applicationStatus: a.status ?? u.applicationStatus ?? "pending",
          applicationSubject: a.subject,
          applicationYearsExperience: a.yearsExperience,
          applicationHighestDegree: a.highestDegree,
          applicationSubmittedAt: a.submittedAt,
          applicationReviewedAt: a.reviewedAt ?? null,
          applicationReviewedBy: a.reviewedBy ?? null,
          applicationReviewNote: a.reviewNote ?? null,
          bio: u.bio ?? a.bio,
          experiences: u.experiences ?? a.experiences ?? [],
          certifications: u.certifications ?? a.certifications ?? [],
          degrees: u.degrees ?? a.degrees ?? [],
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      );
      migrated++;
    }
    return { scanned, migrated, skipped };
  },
};
