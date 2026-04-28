import "server-only";
import { adminDb } from "@/server/firebase-admin";
import { Collections } from "@/shared/constants/collections";

type Submission = {
  autoScore?: number;
  finalScore?: number;
  status?: string;
  submittedAt?: string;
  answers?: { questionId: string; value: unknown }[];
};

type AssessmentMeta = {
  id: string;
  title?: string;
  classroomId?: string;
  totalPoints?: number;
};

type Classroom = {
  id: string;
  name?: string;
  subjectName?: string;
  subjectId?: string;
  studentIds?: string[];
};

export type StudentProgressTopic = {
  id: string;
  name: string;
  pct: number; // 0..100
  color: "green" | "blue" | "amber" | "red";
};

export type StudentProgressSummary = {
  overallPct: number;
  totalPoints: number;
  earnedPoints: number;
  rank: number | null;
  classmatesCount: number;
  topics: StudentProgressTopic[];
  quizHistory: {
    id: string;
    title: string;
    status: "correct" | "wrong" | "partial" | "pending";
    scorePct: number;
    submittedAt?: string;
  }[];
};

function bucketColor(pct: number): StudentProgressTopic["color"] {
  if (pct >= 80) return "green";
  if (pct >= 50) return "blue";
  if (pct >= 25) return "amber";
  return "red";
}

export const studentProgressService = {
  async summary(uid: string): Promise<StudentProgressSummary> {
    // Enrolled classrooms
    const classSnap = await adminDb
      .collection(Collections.CLASSROOMS)
      .where("studentIds", "array-contains", uid)
      .get();
    const classrooms: Classroom[] = classSnap.docs.map(
      (d) => ({ id: d.id, ...(d.data() as Omit<Classroom, "id">) }),
    );
    const classroomIds = classrooms.map((c) => c.id);

    // Assessments across these classrooms (max 30 to keep it snappy)
    const assessments: AssessmentMeta[] = [];
    for (const cid of classroomIds) {
      const snap = await adminDb
        .collection(Collections.ASSESSMENTS)
        .where("classroomId", "==", cid)
        .limit(30)
        .get();
      for (const d of snap.docs) {
        assessments.push({
          id: d.id,
          ...(d.data() as Omit<AssessmentMeta, "id">),
        });
      }
    }

    // Fetch this student's submissions for each assessment
    let earnedPoints = 0;
    let totalPoints = 0;
    const quizHistory: StudentProgressSummary["quizHistory"] = [];
    const perSubject = new Map<string, { earned: number; total: number }>();

    for (const a of assessments) {
      const subDoc = await adminDb
        .collection(Collections.ASSESSMENT_SUBMISSIONS)
        .doc(a.id)
        .collection("responses")
        .doc(uid)
        .get();
      if (!subDoc.exists) continue;
      const sub = subDoc.data() as Submission;
      const pts = a.totalPoints ?? 0;
      const score = sub.finalScore ?? sub.autoScore ?? 0;
      totalPoints += pts;
      earnedPoints += score;

      const pct = pts > 0 ? (score / pts) * 100 : 0;
      const status: StudentProgressSummary["quizHistory"][number]["status"] =
        sub.status === "graded" && pct >= 90
          ? "correct"
          : sub.status === "graded" && pct < 40
            ? "wrong"
            : sub.status === "graded"
              ? "partial"
              : "pending";
      quizHistory.push({
        id: a.id,
        title: a.title ?? "Assessment",
        status,
        scorePct: Math.round(pct),
        submittedAt: sub.submittedAt,
      });

      const cr = classrooms.find((c) => c.id === a.classroomId);
      const key = cr?.subjectName ?? cr?.subjectId ?? cr?.name ?? "General";
      const cur = perSubject.get(key) ?? { earned: 0, total: 0 };
      cur.earned += score;
      cur.total += pts;
      perSubject.set(key, cur);
    }

    quizHistory.sort((a, b) => (b.submittedAt ?? "").localeCompare(a.submittedAt ?? ""));

    const topics: StudentProgressTopic[] = Array.from(perSubject.entries()).map(
      ([name, { earned, total }]) => {
        const pct = total > 0 ? Math.round((earned / total) * 100) : 0;
        return { id: name, name, pct, color: bucketColor(pct) };
      },
    );

    // Rank among classmates (across all enrolled classrooms)
    const classmatesSet = new Set<string>();
    for (const c of classrooms) for (const s of c.studentIds ?? []) classmatesSet.add(s);
    classmatesSet.delete(uid);

    let rank: number | null = null;
    if (classmatesSet.size > 0 && assessments.length > 0) {
      const scores = new Map<string, { earned: number; total: number }>();
      scores.set(uid, { earned: earnedPoints, total: totalPoints });
      for (const other of classmatesSet) scores.set(other, { earned: 0, total: 0 });

      for (const a of assessments) {
        const respSnap = await adminDb
          .collection(Collections.ASSESSMENT_SUBMISSIONS)
          .doc(a.id)
          .collection("responses")
          .get();
        for (const d of respSnap.docs) {
          const bucket = scores.get(d.id);
          if (!bucket) continue;
          const s = d.data() as Submission;
          bucket.earned += s.finalScore ?? s.autoScore ?? 0;
          bucket.total += a.totalPoints ?? 0;
        }
      }

      const arr = Array.from(scores.entries()).map(([id, { earned, total }]) => ({
        id,
        pct: total > 0 ? earned / total : 0,
      }));
      arr.sort((a, b) => b.pct - a.pct);
      rank = arr.findIndex((x) => x.id === uid) + 1;
    }

    const overallPct =
      totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;

    return {
      overallPct,
      totalPoints,
      earnedPoints,
      rank,
      classmatesCount: classmatesSet.size + 1,
      topics,
      quizHistory,
    };
  },
};
