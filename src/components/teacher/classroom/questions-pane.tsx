"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePubSub } from "@videosdk.live/react-sdk";
import {
  Check,
  Pin,
  PinOff,
  Trash2,
  MessageSquare,
  Loader2,
  Filter as FilterIcon,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api/client";
import { getFirebaseAuth } from "@/lib/firebase/client";
import type { ClassQuestion } from "@/server/services/class-questions.service";

type Filter = "all" | "pending" | "answered";

/** Live student Q&A panel.
 *  — Students submit questions via POST /api/classrooms/:id/questions
 *  — Teacher sees them here; can mark answered / pin / delete
 *  — Pubsub `NEW_QUESTION` triggers a background refetch so this updates live */
export function QuestionsPane({ classroomId }: { classroomId: string }) {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Filter>("all");
  const [discussingId, setDiscussingId] = useState<string | null>(null);

  const { data: questions = [], isLoading } = useQuery({
    queryKey: ["class-questions", classroomId],
    queryFn: () =>
      api.get(
        `/classrooms/${classroomId}/questions`,
      ) as unknown as Promise<ClassQuestion[]>,
    enabled: !!classroomId,
    refetchInterval: 15_000,
  });

  // Pubsub nudge: refetch whenever a new question is broadcast
  const { messages } = usePubSub("NEW_QUESTION");
  useEffect(() => {
    if (messages.length === 0) return;
    qc.invalidateQueries({ queryKey: ["class-questions", classroomId] });
  }, [messages.length, classroomId, qc]);

  const { publish: publishDiscuss } = usePubSub("QUESTION_DISCUSS");

  const patchMut = useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string;
      patch: Partial<Pick<ClassQuestion, "status" | "pinned" | "aiAnswer">>;
    }) => api.patch(`/classrooms/${classroomId}/questions/${id}`, patch),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["class-questions", classroomId] }),
  });

  const [aiLoadingId, setAiLoadingId] = useState<string | null>(null);
  const askAi = async (q: ClassQuestion) => {
    setAiLoadingId(q.id);
    try {
      const token = await getFirebaseAuth().currentUser?.getIdToken();
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          messages: [
            {
              role: "user",
              content: `A student named ${q.askedByName} asked this question in a live class:
"${q.text}"

Answer directly and clearly in 2-4 sentences. No preamble — start with the answer.`,
            },
          ],
          temperature: 0.4,
        }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        data?: { text: string };
      };
      const answer = data.data?.text?.trim();
      if (!answer) throw new Error("AI returned no answer");
      await patchMut.mutateAsync({
        id: q.id,
        patch: { aiAnswer: answer, status: "answered" },
      });
      toast.success("AI answered the question");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "AI answer failed");
    } finally {
      setAiLoadingId(null);
    }
  };

  const deleteMut = useMutation({
    mutationFn: (id: string) =>
      api.delete(`/classrooms/${classroomId}/questions/${id}`),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["class-questions", classroomId] }),
  });

  const filtered = useMemo(() => {
    const sorted = [...questions].sort((a, b) => {
      // Pinned first, then pending, then by newest
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      if (a.status !== b.status) {
        const rank = (s: string) =>
          s === "pending" ? 0 : s === "answered" ? 1 : 2;
        return rank(a.status) - rank(b.status);
      }
      return a.createdAt < b.createdAt ? 1 : -1;
    });
    if (filter === "all") return sorted;
    return sorted.filter((q) => q.status === filter);
  }, [questions, filter]);

  const pendingCount = questions.filter((q) => q.status === "pending").length;
  const answeredCount = questions.filter((q) => q.status === "answered").length;

  const markAnswered = (q: ClassQuestion) => {
    patchMut.mutate({ id: q.id, patch: { status: "answered" } });
    if (discussingId === q.id) setDiscussingId(null);
  };
  const togglePin = (q: ClassQuestion) =>
    patchMut.mutate({ id: q.id, patch: { pinned: !q.pinned } });
  const discuss = (q: ClassQuestion) => {
    setDiscussingId(q.id);
    publishDiscuss(JSON.stringify({ questionId: q.id, text: q.text }), {
      persist: false,
    });
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-surf">
      {/* Top summary bar */}
      <div className="flex flex-shrink-0 items-center gap-2 border-b border-bd bg-panel px-3.5 py-2">
        <MessageSquare className="h-4 w-4 text-t2" />
        <div>
          <p className="text-[12px] font-semibold text-t">Student questions</p>
          <p className="text-[10px] text-t3">
            Submitted live by students during class — mark them answered as you
            address them
          </p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <StatPill label="Pending" n={pendingCount} tone="red" />
          <StatPill label="Answered" n={answeredCount} tone="green" />
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-shrink-0 items-center gap-1.5 border-b border-bd bg-surf px-3 py-1.5">
        <FilterIcon className="h-3 w-3 text-t3" />
        {(
          [
            { id: "all" as const, label: `All (${questions.length})` },
            { id: "pending" as const, label: `Pending (${pendingCount})` },
            { id: "answered" as const, label: `Answered (${answeredCount})` },
          ]
        ).map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
              filter === f.id
                ? "border-acc bg-acc text-white"
                : "border-bd bg-surf text-t2 hover:bg-panel"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-[11px] text-t3">
            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            Loading questions…
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState filter={filter} />
        ) : (
          <div className="space-y-1.5">
            {filtered.map((q) => (
              <QuestionRow
                key={q.id}
                q={q}
                discussing={discussingId === q.id}
                onAnswered={() => markAnswered(q)}
                onPin={() => togglePin(q)}
                onDelete={() => deleteMut.mutate(q.id)}
                onDiscuss={() => discuss(q)}
                onAskAi={() => askAi(q)}
                aiLoading={aiLoadingId === q.id}
                deleting={deleteMut.isPending && deleteMut.variables === q.id}
                patching={
                  patchMut.isPending &&
                  (patchMut.variables as { id: string } | undefined)?.id === q.id
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatPill({
  label,
  n,
  tone,
}: {
  label: string;
  n: number;
  tone: "red" | "green";
}) {
  const c =
    tone === "red"
      ? "border-rbd bg-rbg text-rt"
      : "border-gbd bg-gbg text-gt";
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${c}`}>
      {n} {label}
    </span>
  );
}

function EmptyState({ filter }: { filter: Filter }) {
  const msg =
    filter === "pending"
      ? "No pending questions right now."
      : filter === "answered"
        ? "No questions have been answered yet."
        : "No questions yet. Students will submit questions from their side of the class and they'll show up here live.";
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
      <MessageSquare className="h-8 w-8 text-t3" />
      <p className="text-[11px] leading-[1.6] text-t3">{msg}</p>
    </div>
  );
}

function QuestionRow({
  q,
  discussing,
  onAnswered,
  onPin,
  onDelete,
  onDiscuss,
  onAskAi,
  aiLoading,
  patching,
  deleting,
}: {
  q: ClassQuestion;
  discussing: boolean;
  onAnswered: () => void;
  onPin: () => void;
  onDelete: () => void;
  onDiscuss: () => void;
  onAskAi: () => void;
  aiLoading: boolean;
  patching: boolean;
  deleting: boolean;
}) {
  const time = new Date(q.createdAt);
  const tlabel = `${time.getHours()}:${String(time.getMinutes()).padStart(2, "0")}`;

  const statusStyles: Record<ClassQuestion["status"], string> = {
    pending: "border-amber-200 bg-amber-50",
    answered: "border-green-200 bg-green-50/50 opacity-75",
    dismissed: "border-gray-200 bg-gray-50 opacity-50",
  };

  return (
    <div
      className={`rounded-[10px] border px-3 py-2.5 transition-colors ${
        discussing ? "ring-2 ring-purple-400 border-pbd bg-pbg" : statusStyles[q.status]
      } ${q.pinned ? "border-l-[3px] border-l-blue-500" : ""}`}
    >
      <div className="mb-1.5 flex items-center gap-2">
        <div
          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
          style={{ background: colorForName(q.askedByName) }}
        >
          {q.askedByName.slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1">
          <p className="text-[11px] font-semibold text-t">{q.askedByName}</p>
          <p className="text-[10px] text-t3">asked at {tlabel}</p>
        </div>
        {q.pinned && (
          <span className="rounded bg-bbg px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[.3px] text-bt">
            Pinned
          </span>
        )}
        {q.status === "answered" && (
          <span className="rounded bg-gbg px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[.3px] text-gt">
            Answered
          </span>
        )}
      </div>

      <p className="mb-2 whitespace-pre-wrap pl-9 text-[12px] leading-[1.5] text-t">
        {q.text}
      </p>

      {q.aiAnswer && (
        <div
          className="ml-9 mb-2 rounded-[10px] border px-3 py-2"
          style={{
            background: "var(--pbg)",
            borderColor: "var(--pbd)",
            color: "var(--pt)",
          }}
        >
          <div className="mb-1 flex items-center gap-1.5">
            <Sparkles className="h-2.5 w-2.5" />
            <span className="text-[9px] font-bold uppercase tracking-[.3px]">
              AI answer
            </span>
            {q.aiAnsweredAt && (
              <span className="text-[9px] opacity-70">
                {new Date(q.aiAnsweredAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            )}
          </div>
          <p className="whitespace-pre-wrap text-[11.5px] leading-[1.55]">
            {q.aiAnswer}
          </p>
        </div>
      )}

      {/* Action row */}
      <div className="ml-9 flex items-center gap-1.5">
        {q.status !== "answered" && (
          <button
            onClick={onDiscuss}
            disabled={patching}
            className={`rounded-md border px-2 py-0.5 text-[10px] font-medium transition-colors disabled:opacity-40 ${
              discussing
                ? "border-purple-400 bg-purple-500 text-white"
                : "border-bd2 bg-white text-t2 hover:bg-panel"
            }`}
          >
            {discussing ? "Discussing…" : "💬 Discuss"}
          </button>
        )}
        {q.status !== "answered" && !q.aiAnswer && (
          <button
            onClick={onAskAi}
            disabled={aiLoading || patching}
            className="flex items-center gap-1 rounded-md border border-pbd bg-pbg px-2 py-0.5 text-[10px] font-medium text-pt hover:bg-purple-100 disabled:opacity-40"
            title="Let AI answer this question"
          >
            {aiLoading ? (
              <Loader2 className="h-2.5 w-2.5 animate-spin" />
            ) : (
              <Sparkles className="h-2.5 w-2.5" />
            )}
            {aiLoading ? "AI answering…" : "Let AI answer"}
          </button>
        )}
        {q.status !== "answered" ? (
          <button
            onClick={onAnswered}
            disabled={patching}
            className="flex items-center gap-1 rounded-md bg-green-500 px-2 py-0.5 text-[10px] font-medium text-white hover:bg-green-600 disabled:opacity-40"
          >
            {patching ? (
              <Loader2 className="h-2.5 w-2.5 animate-spin" />
            ) : (
              <Check className="h-2.5 w-2.5" />
            )}
            Mark answered
          </button>
        ) : (
          <span className="text-[10px] text-t3">
            Answered{" "}
            {q.answeredAt
              ? new Date(q.answeredAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : ""}
          </span>
        )}
        <button
          onClick={onPin}
          disabled={patching}
          className="rounded-md border border-bd2 bg-white px-1.5 py-0.5 text-t2 hover:bg-panel disabled:opacity-40"
          title={q.pinned ? "Unpin" : "Pin to top"}
        >
          {q.pinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
        </button>
        <button
          onClick={onDelete}
          disabled={deleting}
          className="ml-auto rounded-md border border-transparent bg-transparent p-1 text-t3 hover:border-rbd hover:bg-rbg hover:text-rt disabled:opacity-40"
          title="Delete"
        >
          {deleting ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Trash2 className="h-3 w-3" />
          )}
        </button>
      </div>
    </div>
  );
}

function colorForName(name: string): string {
  const colors = [
    "#7C3AED",
    "#2563EB",
    "#16A34A",
    "#D97706",
    "#DC2626",
    "#0891B2",
  ];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h + name.charCodeAt(i)) % colors.length;
  return colors[h];
}
