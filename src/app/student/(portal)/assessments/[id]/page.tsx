"use client";

import { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import Link from "next/link";
import api from "@/lib/api/client";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  ChevronLeft,
  ChevronRight,
  Send,
} from "lucide-react";

type Question = {
  id: string;
  type: "mcq" | "short" | "tf";
  text: string;
  options?: string[];
  points: number;
  order: number;
};

type Assessment = {
  id: string;
  title: string;
  instructions?: string;
  totalPoints: number;
  dueAt?: string;
  classroomId: string;
};

type Submission = {
  uid: string;
  answers: { questionId: string; value: string | number | boolean }[];
  submittedAt: string;
  autoScore: number;
  manualScore?: number;
  finalScore?: number;
  status: "submitted" | "graded";
  feedback?: string;
};

type Answer = { questionId: string; value: string | number | boolean };

export default function StudentAssessmentAttemptPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const qc = useQueryClient();

  const assessmentQ = useQuery({
    queryKey: ["assessment", id],
    queryFn: () =>
      api.get(`/assessments/${id}`) as unknown as Promise<Assessment>,
    enabled: !!id,
  });

  const questionsQ = useQuery({
    queryKey: ["assessment-questions", id],
    queryFn: () =>
      api.get(`/assessments/${id}/questions`) as unknown as Promise<Question[]>,
    enabled: !!id,
  });

  const submissionQ = useQuery({
    queryKey: ["assessment-submission", id],
    queryFn: async () => {
      try {
        return (await api.get(
          `/assessments/${id}/submission/me`,
        )) as unknown as Submission;
      } catch {
        return null;
      }
    },
    enabled: !!id,
    retry: false,
  });

  const [answers, setAnswers] = useState<Record<string, string | number | boolean>>({});
  const [current, setCurrent] = useState(0);

  const questions = useMemo(
    () => (questionsQ.data ?? []).slice().sort((a, b) => a.order - b.order),
    [questionsQ.data],
  );

  const submitMut = useMutation({
    mutationFn: (payload: { answers: Answer[] }) =>
      api.post(`/assessments/${id}/submit`, payload),
    onSuccess: () => {
      toast.success("Submitted!");
      qc.invalidateQueries({ queryKey: ["assessment-submission", id] });
      qc.invalidateQueries({ queryKey: ["student", "assessments"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function setAnswer(qid: string, value: string | number | boolean) {
    setAnswers((a) => ({ ...a, [qid]: value }));
  }

  function handleSubmit() {
    const unanswered = questions.filter((q) => answers[q.id] == null);
    if (unanswered.length > 0) {
      const ok = confirm(
        `${unanswered.length} question${unanswered.length === 1 ? "" : "s"} unanswered. Submit anyway?`,
      );
      if (!ok) return;
    }
    submitMut.mutate({
      answers: Object.entries(answers).map(([questionId, value]) => ({
        questionId,
        value,
      })),
    });
  }

  if (assessmentQ.isLoading || questionsQ.isLoading || submissionQ.isLoading) {
    return (
      <div className="flex-1 overflow-y-auto bg-bg p-6">
        <div className="mx-auto max-w-3xl space-y-3">
          <div className="h-6 w-64 animate-pulse rounded bg-panel" />
          <div className="h-40 animate-pulse rounded-xl bg-panel" />
        </div>
      </div>
    );
  }

  if (!assessmentQ.data) {
    return (
      <div className="flex-1 overflow-y-auto bg-bg p-6">
        <div className="mx-auto max-w-3xl">
          <p className="text-sm text-t2">Assessment not found.</p>
          <Link href="/student/assessments" className="text-xs text-blue hover:underline">
            Back to assessments
          </Link>
        </div>
      </div>
    );
  }

  // Already submitted — show result view
  if (submissionQ.data) {
    return (
      <ResultView
        assessment={assessmentQ.data}
        questions={questions}
        submission={submissionQ.data}
      />
    );
  }

  const q = questions[current];
  const answered = Object.keys(answers).length;

  return (
    <div className="flex-1 overflow-y-auto bg-bg p-6">
      <div className="mx-auto max-w-3xl space-y-5">
        <button
          onClick={() => router.push("/student/assessments")}
          className="flex items-center gap-1.5 text-xs text-t3 hover:text-t2"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to assessments
        </button>

        <div className="rounded-xl border border-bd bg-surf p-5">
          <h1 className="text-base font-semibold text-t">{assessmentQ.data.title}</h1>
          {assessmentQ.data.instructions && (
            <p className="mt-2 text-xs leading-relaxed text-t2">
              {assessmentQ.data.instructions}
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-t3">
            <span>{questions.length} questions</span>
            <span>·</span>
            <span>{assessmentQ.data.totalPoints} points total</span>
            {assessmentQ.data.dueAt && (
              <>
                <span>·</span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Due {new Date(assessmentQ.data.dueAt).toLocaleString()}
                </span>
              </>
            )}
          </div>
        </div>

        {!questions.length ? (
          <div className="rounded-xl border border-bd bg-surf p-8 text-center">
            <p className="text-sm text-t2">This assessment has no questions yet.</p>
          </div>
        ) : (
          <>
            {/* Progress */}
            <div className="flex items-center justify-between">
              <p className="text-xs text-t3">
                Question {current + 1} of {questions.length} · {answered} answered
              </p>
              <div className="flex flex-1 ml-4 h-1 overflow-hidden rounded bg-bd">
                <div
                  className="h-full bg-acc transition-all"
                  style={{ width: `${((current + 1) / questions.length) * 100}%` }}
                />
              </div>
            </div>

            {/* Question card */}
            <div className="rounded-xl border border-bd bg-surf p-5">
              <div className="mb-3 flex items-center gap-2">
                <span className="rounded-full bg-acc px-2.5 py-0.5 text-[10px] font-bold text-white">
                  Q{current + 1}
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-t3">
                  {q.type === "mcq" ? "Multiple choice" : q.type === "tf" ? "True / False" : "Short answer"}
                </span>
                <span className="ml-auto text-[10px] text-t3">{q.points} pt{q.points === 1 ? "" : "s"}</span>
              </div>
              <p className="mb-5 text-sm leading-relaxed text-t">{q.text}</p>

              {q.type === "mcq" && q.options && (
                <div className="space-y-2">
                  {q.options.map((opt, i) => (
                    <label
                      key={i}
                      className={`flex cursor-pointer items-center gap-3 rounded-lg border-2 p-3 transition-colors ${
                        answers[q.id] === i
                          ? "border-acc bg-accbg"
                          : "border-bd bg-surf hover:bg-panel"
                      }`}
                    >
                      <input
                        type="radio"
                        name={q.id}
                        checked={answers[q.id] === i}
                        onChange={() => setAnswer(q.id, i)}
                        className="h-4 w-4"
                      />
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-panel text-[10px] font-bold text-t2">
                        {String.fromCharCode(65 + i)}
                      </span>
                      <span className="flex-1 text-sm text-t">{opt}</span>
                    </label>
                  ))}
                </div>
              )}

              {q.type === "tf" && (
                <div className="grid grid-cols-2 gap-2">
                  {[true, false].map((v) => (
                    <button
                      key={String(v)}
                      onClick={() => setAnswer(q.id, v)}
                      className={`rounded-lg border-2 py-3 text-sm font-medium transition-colors ${
                        answers[q.id] === v
                          ? "border-acc bg-accbg text-t"
                          : "border-bd bg-surf text-t2 hover:bg-panel"
                      }`}
                    >
                      {v ? "✓ True" : "✕ False"}
                    </button>
                  ))}
                </div>
              )}

              {q.type === "short" && (
                <textarea
                  value={(answers[q.id] as string | undefined) ?? ""}
                  onChange={(e) => setAnswer(q.id, e.target.value)}
                  rows={4}
                  placeholder="Type your answer…"
                  className="w-full resize-y rounded-lg border border-bd bg-surf px-3 py-2 text-sm text-t outline-none focus:border-acc"
                />
              )}
            </div>

            {/* Navigation */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrent((c) => Math.max(0, c - 1))}
                disabled={current === 0}
                className="flex items-center gap-1.5 rounded-lg border border-bd bg-surf px-3 py-2 text-xs font-medium text-t2 hover:bg-panel disabled:opacity-40"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Previous
              </button>

              <div className="mx-auto flex flex-wrap justify-center gap-1">
                {questions.map((qq, i) => (
                  <button
                    key={qq.id}
                    onClick={() => setCurrent(i)}
                    className={`h-6 w-6 rounded-md text-[10px] font-semibold ${
                      i === current
                        ? "bg-acc text-white"
                        : answers[qq.id] != null
                          ? "bg-gbg text-gt"
                          : "bg-panel text-t3"
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>

              {current < questions.length - 1 ? (
                <button
                  onClick={() => setCurrent((c) => Math.min(questions.length - 1, c + 1))}
                  className="flex items-center gap-1.5 rounded-lg bg-acc px-3 py-2 text-xs font-semibold text-white hover:opacity-90"
                >
                  Next
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={submitMut.isPending}
                  className="flex items-center gap-1.5 rounded-lg bg-green px-4 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                >
                  <Send className="h-3.5 w-3.5" />
                  {submitMut.isPending ? "Submitting…" : "Submit"}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ResultView({
  assessment,
  questions,
  submission,
}: {
  assessment: Assessment;
  questions: Question[];
  submission: Submission;
}) {
  const score = submission.finalScore ?? submission.autoScore ?? 0;
  const pct =
    assessment.totalPoints > 0 ? Math.round((score / assessment.totalPoints) * 100) : 0;
  const isGraded = submission.status === "graded";

  return (
    <div className="flex-1 overflow-y-auto bg-bg p-6">
      <div className="mx-auto max-w-3xl space-y-5">
        <Link
          href="/student/assessments"
          className="flex items-center gap-1.5 text-xs text-t3 hover:text-t2"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to assessments
        </Link>

        <div
          className={`rounded-xl border-2 p-6 ${
            isGraded
              ? pct >= 70
                ? "border-gbd bg-gbg"
                : pct >= 50
                  ? "border-abd bg-abg"
                  : "border-rbd bg-rbg"
              : "border-bbd bg-bbg"
          }`}
        >
          <div className="flex items-start gap-4">
            <div
              className={`flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full ${
                isGraded ? "bg-surf" : "bg-surf"
              }`}
            >
              {isGraded ? (
                <CheckCircle2 className="h-7 w-7 text-gt" />
              ) : (
                <Clock className="h-6 w-6 text-bt" />
              )}
            </div>
            <div>
              <h1 className="text-base font-semibold text-t">{assessment.title}</h1>
              <p className="mt-1 text-xs text-t2">
                Submitted {new Date(submission.submittedAt).toLocaleString()}
              </p>
              {isGraded ? (
                <div className="mt-2 flex items-center gap-3">
                  <span className="text-2xl font-bold text-t">
                    {score}/{assessment.totalPoints}
                  </span>
                  <span className="rounded-full bg-surf px-3 py-1 text-xs font-bold text-t">
                    {pct}%
                  </span>
                </div>
              ) : (
                <p className="mt-2 text-xs font-medium text-bt">
                  Awaiting manual grading from your teacher
                </p>
              )}
              {submission.feedback && (
                <div className="mt-3 rounded-lg border border-bd bg-surf p-3">
                  <p className="text-[10px] font-semibold uppercase text-t3">
                    Teacher feedback
                  </p>
                  <p className="mt-1 text-xs text-t2">{submission.feedback}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-t3">
            Your answers
          </h2>
          {questions.map((q, i) => {
            const myAnswer = submission.answers.find((a) => a.questionId === q.id);
            return (
              <div key={q.id} className="rounded-xl border border-bd bg-surf p-4">
                <div className="mb-2 flex items-center gap-2">
                  <span className="rounded bg-panel px-2 py-0.5 text-[10px] font-bold text-t2">
                    Q{i + 1}
                  </span>
                  <span className="text-[10px] text-t3">{q.points} pt{q.points === 1 ? "" : "s"}</span>
                </div>
                <p className="mb-2 text-sm font-medium text-t">{q.text}</p>
                <p className="text-xs text-t3">Your answer:</p>
                <p className="mt-1 text-sm text-t2">
                  {formatAnswer(q, myAnswer?.value)}
                </p>
              </div>
            );
          })}
        </section>
      </div>
    </div>
  );
}

function formatAnswer(q: Question, value: string | number | boolean | undefined) {
  if (value == null) return <span className="italic text-t3">(not answered)</span>;
  if (q.type === "mcq" && q.options && typeof value === "number") {
    return `${String.fromCharCode(65 + value)}. ${q.options[value] ?? ""}`;
  }
  if (q.type === "tf") return value ? "True" : "False";
  return String(value);
}
