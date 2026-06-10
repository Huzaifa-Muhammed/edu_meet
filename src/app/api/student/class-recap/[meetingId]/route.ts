export const dynamic = "force-dynamic";
import "server-only";
import { NextRequest } from "next/server";
import { verifyToken } from "@/server/auth/verify-token";
import { requireRole } from "@/server/auth/require-role";
import { adminDb } from "@/server/firebase-admin";
import { Collections } from "@/shared/constants/collections";
import { resolveSubjectName } from "@/shared/constants/subjects";
import { agendaService } from "@/server/services/agenda.service";
import { classNotesService } from "@/server/services/class-notes.service";
import { classQuestionsService } from "@/server/services/class-questions.service";
import { ok, fail } from "@/server/utils/response";
import { notFound, forbidden } from "@/server/utils/errors";

function normalize(s: string) {
  return s.trim().toLowerCase();
}

/** End-of-class recap for a student: what was covered (agenda), the teacher's
 *  notes, and the Q&A discussed. Read-only aggregation of existing data. */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ meetingId: string }> },
) {
  try {
    const user = await verifyToken(req);
    requireRole(user, ["student"]);
    const { meetingId } = await ctx.params;

    const meetingDoc = await adminDb.collection(Collections.MEETINGS).doc(meetingId).get();
    if (!meetingDoc.exists) throw notFound("Meeting");
    const meeting = meetingDoc.data() as {
      classroomId: string;
      teacherId: string;
      scheduledDate?: string;
      startedAt?: string;
      endedAt?: string;
      title?: string;
    };

    const classDoc = await adminDb
      .collection(Collections.CLASSROOMS)
      .doc(meeting.classroomId)
      .get();
    if (!classDoc.exists) throw notFound("Classroom");
    const c = classDoc.data() as {
      name?: string;
      subjectId?: string;
      subjectName?: string;
      studentIds?: string[];
    };

    // Authorize: student must be enrolled OR interested in the subject.
    const userDoc = await adminDb.collection(Collections.USERS).doc(user.uid).get();
    const subjects = ((userDoc.data()?.subjects as string[] | undefined) ?? []).map(normalize);
    const subjectName = c.subjectName ?? resolveSubjectName(c.subjectId ?? "", c.subjectName);
    const enrolled = (c.studentIds ?? []).includes(user.uid);
    const subjectMatch =
      subjects.includes(normalize(subjectName)) || subjects.includes(normalize(c.subjectId ?? ""));
    if (!enrolled && !subjectMatch) throw forbidden("Not your class");

    const tDoc = await adminDb.collection(Collections.USERS).doc(meeting.teacherId).get();
    const teacherName =
      (tDoc.data()?.displayName as string | undefined) ??
      (tDoc.data()?.name as string | undefined) ??
      "Teacher";

    const [agenda, notes, questions] = await Promise.all([
      agendaService.list(meeting.classroomId),
      classNotesService.list(meeting.classroomId),
      classQuestionsService.list(meeting.classroomId),
    ]);

    const recap = {
      classroomName: c.name ?? meeting.title ?? "Class",
      subjectName,
      teacherName,
      date: meeting.scheduledDate ?? meeting.startedAt?.slice(0, 10) ?? "",
      endedAt: meeting.endedAt ?? null,
      agenda: agenda.map((a) => ({
        title: a.title,
        description: a.description ?? "",
        done: a.done,
      })),
      topicsCovered: agenda.filter((a) => a.done).map((a) => a.title),
      notes: notes
        .filter((n) => n.authorRole === "teacher" || n.authorRole === "admin")
        .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
        .slice(0, 60)
        .map((n) => ({ text: n.text, authorName: n.authorName, createdAt: n.createdAt })),
      questions: questions
        .filter((q) => q.status === "answered" || q.aiAnswer)
        .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
        .slice(0, 60)
        .map((q) => ({
          text: q.text,
          askedByName: q.askedByName,
          answer: q.aiAnswer ?? null,
        })),
    };
    return ok(recap);
  } catch (e) {
    return fail(e);
  }
}
