export const dynamic = "force-dynamic";
import "server-only";
import { NextRequest } from "next/server";
import { verifyToken } from "@/server/auth/verify-token";
import { requireRole } from "@/server/auth/require-role";
import { adminDb } from "@/server/firebase-admin";
import { Collections } from "@/shared/constants/collections";
import { ok, fail } from "@/server/utils/response";

type Notif = {
  id: string;
  kind: "question" | "submission" | "rejoin" | "application" | "system";
  title: string;
  body?: string;
  at: string;
  href?: string;
  read?: boolean; // synthesized — older-than-24h is treated as read
};

export async function GET(req: NextRequest) {
  try {
    const user = await verifyToken(req);
    requireRole(user, ["teacher"]);

    const classroomsSnap = await adminDb
      .collection(Collections.CLASSROOMS)
      .where("teacherId", "==", user.uid)
      .get();
    const classrooms = classroomsSnap.docs.map((d) => ({
      id: d.id,
      name: (d.data() as { name?: string }).name ?? "Class",
    }));
    const classroomNameById = new Map(classrooms.map((c) => [c.id, c.name]));
    const classroomIds = classrooms.map((c) => c.id);

    const notifs: Notif[] = [];

    // Pending student questions
    if (classroomIds.length) {
      for (let i = 0; i < classroomIds.length; i += 10) {
        const batch = classroomIds.slice(i, i + 10);
        const qSnap = await adminDb
          .collection(Collections.CLASS_QUESTIONS)
          .where("classroomId", "in", batch)
          .get();
        for (const d of qSnap.docs) {
          const data = d.data() as {
            text?: string;
            classroomId: string;
            createdAt?: string;
            status?: string;
            studentName?: string;
          };
          if (!data.createdAt) continue;
          notifs.push({
            id: `q-${d.id}`,
            kind: "question",
            title: `${data.studentName ?? "A student"} asked a question`,
            body:
              (data.text ?? "").slice(0, 140) +
              ((data.text?.length ?? 0) > 140 ? "…" : ""),
            at: data.createdAt,
            href: `/teacher/classroom/${data.classroomId}`,
          });
        }
      }
    }

    // Submissions across teacher's assessments
    const assessmentsSnap = await adminDb
      .collection(Collections.ASSESSMENTS)
      .where("teacherId", "==", user.uid)
      .get();
    for (const a of assessmentsSnap.docs) {
      const aData = a.data() as { title?: string; classroomId: string };
      const respSnap = await adminDb
        .collection(Collections.ASSESSMENT_SUBMISSIONS)
        .doc(a.id)
        .collection("responses")
        .get();
      for (const r of respSnap.docs) {
        const d = r.data() as { submittedAt?: string; status?: string };
        if (!d.submittedAt) continue;
        notifs.push({
          id: `s-${a.id}-${r.id}`,
          kind: "submission",
          title: `Submission for ${aData.title ?? "an assessment"}`,
          body:
            d.status === "submitted"
              ? "Needs your grade (short-answer questions)"
              : `Auto-graded · ${classroomNameById.get(aData.classroomId) ?? ""}`,
          at: d.submittedAt,
          href:
            d.status === "submitted"
              ? "/teacher/grading"
              : `/teacher/assessments/${a.id}`,
        });
      }
    }

    // Rejoin requests
    const rejoinSnap = await adminDb
      .collection(Collections.REJOIN_REQUESTS)
      .where("teacherId", "==", user.uid)
      .get();
    for (const d of rejoinSnap.docs) {
      const data = d.data() as {
        studentName?: string;
        createdAt?: string;
        status?: string;
        meetingId?: string;
      };
      notifs.push({
        id: `rj-${d.id}`,
        kind: "rejoin",
        title: `${data.studentName ?? "Student"} requested to rejoin`,
        body: data.status === "pending" ? "Pending your approval" : data.status,
        at: data.createdAt ?? new Date(0).toISOString(),
        href: data.meetingId
          ? `/teacher/classroom/${data.meetingId}`
          : undefined,
      });
    }

    // Teacher's own application status — read straight off the user doc.
    const meSnap = await adminDb
      .collection(Collections.USERS)
      .doc(user.uid)
      .get();
    const me = meSnap.data() as
      | {
          applicationStatus?: string;
          applicationReviewedAt?: string;
          applicationSubmittedAt?: string;
          applicationReviewNote?: string;
        }
      | undefined;
    if (
      me &&
      (me.applicationStatus === "approved" || me.applicationStatus === "rejected")
    ) {
      notifs.push({
        id: `app-${user.uid}`,
        kind: "application",
        title:
          me.applicationStatus === "approved"
            ? "Your teacher application was approved 🎉"
            : "Your teacher application needs revisions",
        body: me.applicationReviewNote,
        at:
          me.applicationReviewedAt ??
          me.applicationSubmittedAt ??
          new Date(0).toISOString(),
        href: "/teacher/profile",
      });
    }

    // Mark older-than-24h as read so the UI can subdue them
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    for (const n of notifs) {
      n.read = new Date(n.at).getTime() < dayAgo;
    }

    notifs.sort((a, b) => b.at.localeCompare(a.at));
    return ok(notifs.slice(0, 80));
  } catch (e) {
    return fail(e);
  }
}
