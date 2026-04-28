export const dynamic = "force-dynamic";
import "server-only";
import { NextRequest } from "next/server";
import { verifyToken } from "@/server/auth/verify-token";
import { requireRole } from "@/server/auth/require-role";
import { adminDb } from "@/server/firebase-admin";
import { Collections } from "@/shared/constants/collections";
import { brainTokensService } from "@/server/services/brain-tokens.service";
import { ok, fail } from "@/server/utils/response";

type Submission = {
  finalScore?: number;
  autoScore?: number;
  status?: string;
  submittedAt?: string;
};

type AssessmentMeta = {
  id: string;
  title?: string;
  classroomId?: string;
  totalPoints?: number;
};

/**
 * Per-session progress for the classroom right-panel Progress tab.
 * Aggregates the student's score across assessments in the same classroom
 * as this meeting, plus a few quiz-history entries if available.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ meetingId: string }> },
) {
  try {
    const user = await verifyToken(req);
    requireRole(user, ["student"]);
    const { meetingId } = await params;

    const meetingDoc = await adminDb
      .collection(Collections.MEETINGS)
      .doc(meetingId)
      .get();
    if (!meetingDoc.exists) {
      return ok({
        correct: 0,
        answered: 0,
        pct: 0,
        streakDays: 0,
        overallPct: 0,
        rank: null,
        totalClassmates: 0,
        topics: [],
        questions: [],
      });
    }
    const classroomId = (meetingDoc.data() as { classroomId?: string }).classroomId ?? "";

    // Score across classroom's assessments
    let earned = 0;
    let total = 0;
    const questions: {
      num: number;
      title: string;
      pct: number;
      status: "correct" | "wrong" | "partial" | "pending";
      timeSec?: number;
    }[] = [];
    let i = 1;

    if (classroomId) {
      const assSnap = await adminDb
        .collection(Collections.ASSESSMENTS)
        .where("classroomId", "==", classroomId)
        .limit(20)
        .get();
      const assessments: AssessmentMeta[] = assSnap.docs.map(
        (d) => ({ id: d.id, ...(d.data() as Omit<AssessmentMeta, "id">) }),
      );
      for (const a of assessments) {
        const subDoc = await adminDb
          .collection(Collections.ASSESSMENT_SUBMISSIONS)
          .doc(a.id)
          .collection("responses")
          .doc(user.uid)
          .get();
        if (!subDoc.exists) continue;
        const sub = subDoc.data() as Submission;
        const pts = a.totalPoints ?? 0;
        const score = sub.finalScore ?? sub.autoScore ?? 0;
        earned += score;
        total += pts;
        const pct = pts > 0 ? Math.round((score / pts) * 100) : 0;
        const status: "correct" | "wrong" | "partial" | "pending" =
          sub.status === "graded" && pct >= 85
            ? "correct"
            : sub.status === "graded" && pct < 40
              ? "wrong"
              : sub.status === "graded"
                ? "partial"
                : "pending";
        questions.push({
          num: i++,
          title: a.title ?? "Question",
          pct,
          status,
        });
      }
    }

    const overallPct = total > 0 ? Math.round((earned / total) * 100) : 0;
    const correct = questions.filter((q) => q.status === "correct").length;
    const answered = questions.filter((q) => q.status !== "pending").length;
    const pct = answered > 0 ? Math.round((correct / answered) * 100) : 0;

    // Streak from brainTokens
    const tokens = await brainTokensService.get(user.uid);

    // Classmates count
    let totalClassmates = 0;
    if (classroomId) {
      const cr = await adminDb.collection(Collections.CLASSROOMS).doc(classroomId).get();
      totalClassmates = ((cr.data() as { studentIds?: string[] }).studentIds ?? []).length;
    }

    return ok({
      correct,
      answered,
      pct,
      overallPct,
      streakDays: tokens.streakDays,
      rank: null as number | null,
      totalClassmates,
      topics: [] as { name: string; icon: string; bg: string; pct: number; color: string }[],
      questions,
    });
  } catch (e) {
    return fail(e);
  }
}
