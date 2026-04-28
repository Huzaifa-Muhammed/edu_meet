"use client";

import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import api from "@/lib/api/client";
import { Modal } from "@/components/shared/modal";

type QuestionForm = {
  type: "mcq" | "short" | "tf";
  text: string;
  points: number;
  options: string[];
  correctIndex?: number;
  correctBool?: boolean;
  correctText?: string;
};

type FormValues = {
  title: string;
  instructions?: string;
  dueAt?: string;
  questions: QuestionForm[];
};

export function CreateAssessmentForm({
  open,
  onClose,
  classroomId,
  classroomName,
}: {
  open: boolean;
  onClose: () => void;
  classroomId: string | null;
  classroomName?: string;
}) {
  const qc = useQueryClient();
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const { register, control, handleSubmit, reset, getValues, watch } = useForm<FormValues>({
    defaultValues: {
      title: "",
      instructions: "",
      questions: [
        { type: "mcq", text: "", points: 1, options: ["", "", "", ""], correctIndex: 0 },
      ],
    },
  });

  const { fields, append, remove, replace } = useFieldArray({
    control,
    name: "questions",
  });

  const createMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      if (!classroomId) throw new Error("No classroom selected");

      const questions = values.questions.map((q, i) => {
        const base = {
          type: q.type,
          text: q.text,
          points: Number(q.points) || 1,
          order: i,
        };
        if (q.type === "mcq") {
          return {
            ...base,
            options: q.options.filter((x) => x.trim()),
            correctIndex: Number(q.correctIndex ?? 0),
          };
        }
        if (q.type === "tf") {
          return { ...base, correctBool: Boolean(q.correctBool) };
        }
        return { ...base, correctText: q.correctText ?? "" };
      });

      return api.post(`/classrooms/${classroomId}/assessments`, {
        title: values.title,
        instructions: values.instructions,
        dueAt: values.dueAt || undefined,
        questions,
        assign: true,
      });
    },
    onSuccess: () => {
      toast.success("Assessment assigned to students");
      qc.invalidateQueries({ queryKey: ["assessments"] });
      reset();
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  async function generateWithAI() {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    try {
      const res = (await api.post("/ai/chat", {
        messages: [
          {
            role: "user",
            content: `Generate 3 MCQ quiz questions for: "${aiPrompt}".
Return ONLY valid JSON in this exact shape (no prose, no fences):
{"questions":[{"text":"...","options":["a","b","c","d"],"correctIndex":0,"points":1}]}`,
          },
        ],
      })) as unknown as { text: string };
      const txt = res.text;
      const match = txt.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("Could not parse AI response");
      const parsed = JSON.parse(match[0]) as {
        questions: {
          text: string;
          options: string[];
          correctIndex: number | string;
          points?: number;
        }[];
      };
      const current = getValues("questions");
      const generated: QuestionForm[] = parsed.questions.map((q) => {
        const opts = [...q.options, "", "", "", ""].slice(0, 4);
        // Groq sometimes returns correctIndex as a string ("2") or out
        // of bounds — clamp to [0, opts.length - 1].
        const idx = Number(q.correctIndex);
        const safe = Number.isFinite(idx) ? Math.min(Math.max(0, idx), 3) : 0;
        return {
          type: "mcq",
          text: q.text,
          options: opts,
          correctIndex: safe,
          points: q.points ?? 1,
        };
      });
      // replace() (not setValue) is required so useFieldArray re-mounts
      // the rows; setValue alone keeps the old radio inputs registered
      // with their original correctIndex=0 state.
      replace([...current.filter((c) => c.text), ...generated]);
      toast.success(`Added ${generated.length} questions`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "AI generation failed");
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <Modal
      open={open && !!classroomId}
      onClose={onClose}
      title={`New Assessment${classroomName ? ` · ${classroomName}` : ""}`}
      description="Build a quiz for this classroom. Questions are auto-assigned to all enrolled students."
      size="xl"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-bd px-3 py-1.5 text-xs font-medium text-t2 hover:bg-panel"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="create-assessment-form"
            disabled={createMutation.isPending}
            className="rounded-lg bg-acc px-4 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {createMutation.isPending ? "Saving..." : "Assign to students"}
          </button>
        </>
      }
    >
      <form
        id="create-assessment-form"
        onSubmit={handleSubmit((v) => createMutation.mutate(v))}
        className="space-y-4"
      >
        <div>
          <label className="mb-1 block text-xs font-medium text-t2">Title</label>
          <input
            {...register("title", { required: true })}
            placeholder="e.g. Week 3 — Linear Equations"
            className="w-full rounded-lg border border-bd bg-surf px-3 py-2 text-sm text-t outline-none focus:border-acc"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-t2">Due date (optional)</label>
            <input
              type="datetime-local"
              {...register("dueAt")}
              className="w-full rounded-lg border border-bd bg-surf px-3 py-2 text-sm text-t outline-none focus:border-acc"
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-t2">Instructions</label>
          <textarea
            {...register("instructions")}
            rows={2}
            placeholder="What should students know before starting?"
            className="w-full rounded-lg border border-bd bg-surf px-3 py-2 text-sm text-t outline-none focus:border-acc"
          />
        </div>

        <div className="rounded-lg border border-pbd bg-pbg p-3">
          <p className="mb-2 text-xs font-semibold text-pt">✨ Generate with AI (Groq)</p>
          <div className="flex gap-2">
            <input
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="e.g. Photosynthesis basics for Grade 7"
              className="flex-1 rounded-lg border border-pbd bg-surf px-3 py-2 text-xs text-t outline-none focus:border-purple"
            />
            <button
              type="button"
              onClick={generateWithAI}
              disabled={aiLoading || !aiPrompt.trim()}
              className="rounded-lg bg-purple px-3 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {aiLoading ? "Generating..." : "Generate"}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-bd pt-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-t3">
            Questions ({fields.length})
          </h3>
          <button
            type="button"
            onClick={() =>
              append({
                type: "mcq",
                text: "",
                points: 1,
                options: ["", "", "", ""],
                correctIndex: 0,
              })
            }
            className="flex items-center gap-1 rounded-lg border border-bd px-2 py-1 text-xs font-medium text-t2 hover:bg-panel"
          >
            <Plus className="h-3 w-3" />
            Add
          </button>
        </div>

        {fields.map((field, idx) => {
          const type = watch(`questions.${idx}.type`);
          return (
            <div key={field.id} className="space-y-2 rounded-lg border border-bd bg-panel/50 p-3">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-t3">Q{idx + 1}</span>
                <select
                  {...register(`questions.${idx}.type`)}
                  className="rounded-md border border-bd bg-surf px-2 py-1 text-xs text-t"
                >
                  <option value="mcq">Multiple choice</option>
                  <option value="tf">True / False</option>
                  <option value="short">Short answer</option>
                </select>
                <input
                  type="number"
                  {...register(`questions.${idx}.points`)}
                  defaultValue={1}
                  min={1}
                  className="w-16 rounded-md border border-bd bg-surf px-2 py-1 text-xs text-t"
                  placeholder="pts"
                />
                <span className="text-[10px] text-t3">pts</span>
                <button
                  type="button"
                  onClick={() => remove(idx)}
                  className="ml-auto rounded-md p-1 text-red hover:bg-rbg"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>

              <textarea
                {...register(`questions.${idx}.text`, { required: true })}
                rows={2}
                placeholder="Question text"
                className="w-full rounded-md border border-bd bg-surf px-3 py-2 text-sm text-t outline-none focus:border-acc"
              />

              {type === "mcq" &&
                [0, 1, 2, 3].map((i) => {
                  const currentCorrect =
                    watch(`questions.${idx}.correctIndex`) ?? 0;
                  return (
                    <label key={i} className="flex items-center gap-2 text-xs">
                      <input
                        type="radio"
                        value={i}
                        {...register(`questions.${idx}.correctIndex`, {
                          valueAsNumber: true,
                        })}
                        defaultChecked={Number(currentCorrect) === i}
                      />
                      <input
                        {...register(`questions.${idx}.options.${i}`)}
                        placeholder={`Option ${String.fromCharCode(65 + i)}`}
                        className="flex-1 rounded-md border border-bd bg-surf px-2 py-1 text-xs text-t"
                      />
                    </label>
                  );
                })}

              {type === "tf" && (
                <div className="flex gap-4 text-xs">
                  <label className="flex items-center gap-1">
                    <input
                      type="radio"
                      value="true"
                      {...register(`questions.${idx}.correctBool`, {
                        setValueAs: (v) => v === "true",
                      })}
                      defaultChecked
                    />
                    True
                  </label>
                  <label className="flex items-center gap-1">
                    <input
                      type="radio"
                      value="false"
                      {...register(`questions.${idx}.correctBool`, {
                        setValueAs: (v) => v === "true",
                      })}
                    />
                    False
                  </label>
                </div>
              )}

              {type === "short" && (
                <input
                  {...register(`questions.${idx}.correctText`)}
                  placeholder="Expected answer (for reference; teacher grades manually)"
                  className="w-full rounded-md border border-bd bg-surf px-3 py-2 text-xs text-t"
                />
              )}
            </div>
          );
        })}
      </form>
    </Modal>
  );
}
