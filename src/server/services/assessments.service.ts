import "server-only";
import { adminDb } from "@/server/firebase-admin";
import { Collections } from "@/shared/constants/collections";
import { notFound } from "@/server/utils/errors";
import { brainTokensService } from "@/server/services/brain-tokens.service";
import type {
  AssessmentCreateInput,
  AssessmentQuestionInput,
  AssessmentSubmitInput,
  AssessmentGradeInput,
} from "@/shared/schemas/assessment.schema";

export const assessmentsService = {
  async create(teacherId: string, data: AssessmentCreateInput) {
    const assessmentData = {
      ...data,
      teacherId,
      totalPoints: data.totalPoints ?? 0,
      status: "draft",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const ref = await adminDb
      .collection(Collections.ASSESSMENTS)
      .add(assessmentData);
    return { id: ref.id, ...assessmentData };
  },

  async getById(id: string) {
    const doc = await adminDb.collection(Collections.ASSESSMENTS).doc(id).get();
    if (!doc.exists) throw notFound("Assessment");
    return { id: doc.id, ...doc.data() };
  },

  async list(classroomId?: string, teacherId?: string) {
    let query = adminDb.collection(Collections.ASSESSMENTS) as FirebaseFirestore.Query;
    if (classroomId) query = query.where("classroomId", "==", classroomId);
    if (teacherId) query = query.where("teacherId", "==", teacherId);

    const snap = await query.orderBy("createdAt", "desc").get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  },

  async update(id: string, data: Partial<AssessmentCreateInput>) {
    await adminDb.collection(Collections.ASSESSMENTS).doc(id).update({
      ...data,
      updatedAt: new Date().toISOString(),
    });
    return { id, ...data };
  },

  async remove(id: string) {
    await adminDb.collection(Collections.ASSESSMENTS).doc(id).delete();
  },

  async assign(id: string) {
    await adminDb.collection(Collections.ASSESSMENTS).doc(id).update({
      status: "assigned",
      updatedAt: new Date().toISOString(),
    });
    return { id, status: "assigned" };
  },

  // Questions
  async addQuestion(assessmentId: string, data: AssessmentQuestionInput) {
    const ref = await adminDb
      .collection(Collections.ASSESSMENT_QUESTIONS)
      .doc(assessmentId)
      .collection("items")
      .add(data);
    return { id: ref.id, assessmentId, ...data };
  },

  async getQuestions(assessmentId: string) {
    const snap = await adminDb
      .collection(Collections.ASSESSMENT_QUESTIONS)
      .doc(assessmentId)
      .collection("items")
      .orderBy("order", "asc")
      .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  },

  async updateQuestion(
    assessmentId: string,
    questionId: string,
    data: Partial<AssessmentQuestionInput>,
  ) {
    await adminDb
      .collection(Collections.ASSESSMENT_QUESTIONS)
      .doc(assessmentId)
      .collection("items")
      .doc(questionId)
      .update(data);
    return { id: questionId, ...data };
  },

  async deleteQuestion(assessmentId: string, questionId: string) {
    await adminDb
      .collection(Collections.ASSESSMENT_QUESTIONS)
      .doc(assessmentId)
      .collection("items")
      .doc(questionId)
      .delete();
  },

  // Submissions
  async submit(assessmentId: string, uid: string, data: AssessmentSubmitInput) {
    const questions = await assessmentsService.getQuestions(assessmentId);
    let autoScore = 0;
    let correctCount = 0;
    let hasShortAnswer = false;

    for (const answer of data.answers) {
      const q = questions.find((question) => question.id === answer.questionId);
      if (!q) continue;

      const qData = q as unknown as AssessmentQuestionInput & { id: string };

      if (qData.type === "mcq") {
        if (Number(answer.value) === qData.correctIndex) {
          autoScore += qData.points;
          correctCount += 1;
        }
      } else if (qData.type === "tf") {
        if (Boolean(answer.value) === qData.correctBool) {
          autoScore += qData.points;
          correctCount += 1;
        }
      } else {
        hasShortAnswer = true;
      }
    }

    const existingDoc = await adminDb
      .collection(Collections.ASSESSMENT_SUBMISSIONS)
      .doc(assessmentId)
      .collection("responses")
      .doc(uid)
      .get();
    const alreadySubmitted = existingDoc.exists;

    const submission = {
      answers: data.answers,
      submittedAt: new Date().toISOString(),
      autoScore,
      status: hasShortAnswer ? "submitted" : "graded",
      finalScore: hasShortAnswer ? undefined : autoScore,
    };

    await adminDb
      .collection(Collections.ASSESSMENT_SUBMISSIONS)
      .doc(assessmentId)
      .collection("responses")
      .doc(uid)
      .set(submission);

    // BT credit: +1 BT per auto-graded correct answer, on first submission only.
    // (Re-submissions don't re-credit to prevent gaming.)
    if (!alreadySubmitted && correctCount > 0) {
      try {
        const assDoc = await adminDb
          .collection(Collections.ASSESSMENTS)
          .doc(assessmentId)
          .get();
        const assTitle = (assDoc.data() as { title?: string } | undefined)?.title ?? "Assessment";
        const classroomId = (assDoc.data() as { classroomId?: string } | undefined)?.classroomId;
        await brainTokensService.credit(uid, correctCount, {
          reason: "correct_answer",
          title: `Correct answers in ${assTitle}`,
          source: "Auto-grade",
          classroomId,
        });
      } catch (err) {
        // Ledger failure shouldn't block submission
        console.warn("[assessments] BT credit failed:", err);
      }
    }

    return submission;
  },

  async grade(assessmentId: string, data: AssessmentGradeInput) {
    const subRef = adminDb
      .collection(Collections.ASSESSMENT_SUBMISSIONS)
      .doc(assessmentId)
      .collection("responses")
      .doc(data.uid);

    const subDoc = await subRef.get();
    if (!subDoc.exists) throw notFound("Submission");

    const existing = subDoc.data()!;
    const manualScore = data.perQuestionScores.reduce(
      (sum, q) => sum + q.score,
      0,
    );
    const finalScore = (existing.autoScore ?? 0) + manualScore;

    await subRef.update({
      manualScore,
      finalScore,
      status: "graded",
      gradedAt: new Date().toISOString(),
      feedback: data.feedback ?? null,
    });

    return { assessmentId, uid: data.uid, finalScore, status: "graded" };
  },

  async getResponses(assessmentId: string) {
    const snap = await adminDb
      .collection(Collections.ASSESSMENT_SUBMISSIONS)
      .doc(assessmentId)
      .collection("responses")
      .get();
    return snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
  },

  async getStudentResult(assessmentId: string, uid: string) {
    const doc = await adminDb
      .collection(Collections.ASSESSMENT_SUBMISSIONS)
      .doc(assessmentId)
      .collection("responses")
      .doc(uid)
      .get();
    if (!doc.exists) throw notFound("Submission");
    return { uid: doc.id, ...doc.data() };
  },
};
