export const dynamic = "force-dynamic";
import "server-only";
import { NextRequest } from "next/server";
import { verifyToken } from "@/server/auth/verify-token";
import { requireRole } from "@/server/auth/require-role";
import { adminDb } from "@/server/firebase-admin";
import { Collections } from "@/shared/constants/collections";
import { brainTokensService } from "@/server/services/brain-tokens.service";
import { ok, fail } from "@/server/utils/response";

type AttendanceEvent = {
  id: string;
  meetingId: string;
  uid: string;
  type: string;
  ts: string;
};

type Submission = {
  submittedAt?: string;
  finalScore?: number;
  autoScore?: number;
  status?: string;
};

/**
 * Merged recent-activity feed for the student dashboard:
 *  - recent token transactions (credits + debits)
 *  - recent assessment submissions by this student
 * Sorted by time desc, capped.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await verifyToken(req);
    requireRole(user, ["student"]);

    const [txs, classroomsSnap] = await Promise.all([
      brainTokensService.listTransactions(user.uid, 15),
      adminDb
        .collection(Collections.CLASSROOMS)
        .where("studentIds", "array-contains", user.uid)
        .get(),
    ]);

    type FeedItem = {
      id: string;
      kind: "token" | "quiz" | "attendance";
      title: string;
      subtitle?: string;
      amount?: number;
      at: string;
    };
    const feed: FeedItem[] = [];

    for (const t of txs) {
      feed.push({
        id: `t_${t.id}`,
        kind: "token",
        title: t.title,
        subtitle: t.source,
        amount: t.amount,
        at: t.createdAt,
      });
    }

    const classroomIds = classroomsSnap.docs.map((d) => d.id);
    for (const cid of classroomIds) {
      const assSnap = await adminDb
        .collection(Collections.ASSESSMENTS)
        .where("classroomId", "==", cid)
        .limit(10)
        .get();
      for (const a of assSnap.docs) {
        const subDoc = await adminDb
          .collection(Collections.ASSESSMENT_SUBMISSIONS)
          .doc(a.id)
          .collection("responses")
          .doc(user.uid)
          .get();
        if (!subDoc.exists) continue;
        const sub = subDoc.data() as Submission;
        if (!sub.submittedAt) continue;
        const title = (a.data() as { title?: string }).title ?? "Assessment";
        feed.push({
          id: `q_${a.id}`,
          kind: "quiz",
          title: `${title} submitted`,
          subtitle:
            sub.status === "graded"
              ? `Scored ${sub.finalScore ?? sub.autoScore ?? 0}`
              : "Awaiting grade",
          at: sub.submittedAt,
        });
      }
    }

    feed.sort((a, b) => b.at.localeCompare(a.at));
    return ok(feed.slice(0, 20));
  } catch (e) {
    return fail(e);
  }
}
