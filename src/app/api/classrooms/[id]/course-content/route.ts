export const dynamic = "force-dynamic";
import "server-only";
import { NextRequest } from "next/server";
import { verifyToken } from "@/server/auth/verify-token";
import { adminDb } from "@/server/firebase-admin";
import { Collections } from "@/shared/constants/collections";
import { resolveSubjectName } from "@/shared/constants/subjects";
import { courseContentService } from "@/server/services/course-content.service";
import { ok, fail } from "@/server/utils/response";
import { notFound } from "@/server/utils/errors";

/** Course content (admin-uploaded Drive docs) matched to a classroom's subject.
 *  Any authenticated participant can read it; the teacher uses it to open or
 *  present subject materials in the live class. */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    await verifyToken(req);
    const { id } = await ctx.params;

    const doc = await adminDb.collection(Collections.CLASSROOMS).doc(id).get();
    if (!doc.exists) throw notFound("Classroom");
    const c = doc.data() as {
      subjectId?: string;
      subjectName?: string;
      grade?: number;
      syllabus?: string;
    };
    const subjectName = resolveSubjectName(c.subjectId ?? "", c.subjectName);

    const content = await courseContentService.getForSubject(
      c.subjectId,
      subjectName || c.subjectName,
    );

    return ok({
      subjectName: subjectName || c.subjectName || "",
      available: !!content,
      fileName: content?.fileName ?? null,
      updatedAt: content?.updatedAt ?? null,
      items: content?.items ?? [],
      // The class's grade + exam board so the client can filter the list to
      // what's relevant (with a "show all" escape hatch).
      classroomGrade: c.grade ?? null,
      classroomSyllabus: c.syllabus ?? null,
    });
  } catch (e) {
    return fail(e);
  }
}
