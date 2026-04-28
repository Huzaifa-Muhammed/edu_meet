"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import api from "@/lib/api/client";
import { Modal } from "@/components/shared/modal";
import type { Subject, Classroom, Meeting } from "@/shared/types/domain";
import { FALLBACK_SUBJECTS as SHARED_FALLBACK } from "@/shared/constants/subjects";

const FormSchema = z.object({
  name: z.string().min(1, "Class name required").max(100),
  description: z.string().max(500).optional(),
  grade: z.number().int().min(1).max(12),
  subjectId: z.string().min(1, "Pick a subject"),
  existingClassroomId: z.string().optional(),
  startNow: z.boolean().optional(),
});

type FormValues = z.infer<typeof FormSchema>;

const FALLBACK_SUBJECTS = SHARED_FALLBACK as Subject[];

export function CreateClassForm({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated?: (meeting: Meeting) => void;
}) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<"new" | "existing">("new");

  const subjectsQ = useQuery({
    queryKey: ["subjects"],
    queryFn: () => api.get("/subjects") as unknown as Promise<Subject[]>,
    enabled: open,
  });

  const classroomsQ = useQuery({
    queryKey: ["classrooms"],
    queryFn: () => api.get("/classrooms") as unknown as Promise<Classroom[]>,
    enabled: open,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(FormSchema) as unknown as import("react-hook-form").Resolver<FormValues>,
    defaultValues: { grade: 9, startNow: true },
  });

  const createMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      let classroomId = values.existingClassroomId;

      if (mode === "new") {
        const subjectName =
          displayedSubjects.find((s) => s.id === values.subjectId)?.name;
        const classroom = (await api.post("/classrooms", {
          name: values.name,
          description: values.description,
          grade: values.grade,
          subjectId: values.subjectId,
          subjectName,
        })) as unknown as Classroom;
        classroomId = classroom.id;
      }

      if (!classroomId) throw new Error("Classroom is required");

      const meeting = (await api.post("/meetings", {
        classroomId,
      })) as unknown as Meeting;

      if (values.startNow) {
        await api.post(`/meetings/${meeting.id}/start`, {});
      }

      return meeting;
    },
    onSuccess: (meeting) => {
      toast.success("Class created");
      qc.invalidateQueries({ queryKey: ["meetings"] });
      qc.invalidateQueries({ queryKey: ["classrooms"] });
      reset();
      onClose();
      onCreated?.(meeting);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Use API data if available and not empty, otherwise use fallback
  const displayedSubjects = subjectsQ.data?.length ? subjectsQ.data : FALLBACK_SUBJECTS;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Start a class"
      description="Create a classroom or start a meeting for an existing one."
      size="lg"
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
            form="create-class-form"
            disabled={isSubmitting || createMutation.isPending}
            className="rounded-lg bg-acc px-4 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {createMutation.isPending ? "Creating..." : "Start class"}
          </button>
        </>
      }
    >
      <form
        id="create-class-form"
        onSubmit={handleSubmit((v) => createMutation.mutate(v))}
        className="space-y-4"
      >
        <div className="flex gap-2 rounded-lg bg-panel p-1">
          <button
            type="button"
            onClick={() => setMode("new")}
            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium ${
              mode === "new" ? "bg-surf text-t shadow-sm" : "text-t3"
            }`}
          >
            New classroom
          </button>
          <button
            type="button"
            onClick={() => setMode("existing")}
            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium ${
              mode === "existing" ? "bg-surf text-t shadow-sm" : "text-t3"
            }`}
          >
            Existing classroom
          </button>
        </div>

        {mode === "new" ? (
          <>
            <div>
              <label className="mb-1 block text-xs font-medium text-t2">Class name</label>
              <input
                {...register("name")}
                placeholder="e.g. Algebra — Grade 9"
                className="w-full rounded-lg border border-bd bg-surf px-3 py-2 text-sm text-t outline-none focus:border-acc"
              />
              {errors.name && <p className="mt-1 text-xs text-red">{errors.name.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-t2">Subject</label>
                <select
                  {...register("subjectId")}
                  className="w-full rounded-lg border border-bd bg-surf px-3 py-2 text-sm text-t outline-none focus:border-acc"
                >
                  <option value="">Select…</option>
                  {/* Updated mapping to use displayedSubjects */}
                  {displayedSubjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                {errors.subjectId && <p className="mt-1 text-xs text-red">{errors.subjectId.message}</p>}
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-t2">Grade</label>
                <input
                  type="number"
                  min={1}
                  max={12}
                  {...register("grade", { valueAsNumber: true })}
                  className="w-full rounded-lg border border-bd bg-surf px-3 py-2 text-sm text-t outline-none focus:border-acc"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-t2">Description (optional)</label>
              <textarea
                {...register("description")}
                rows={2}
                className="w-full rounded-lg border border-bd bg-surf px-3 py-2 text-sm text-t outline-none focus:border-acc"
              />
            </div>
          </>
        ) : (
          <div>
            <label className="mb-1 block text-xs font-medium text-t2">Classroom</label>
            <select
              {...register("existingClassroomId")}
              className="w-full rounded-lg border border-bd bg-surf px-3 py-2 text-sm text-t outline-none focus:border-acc"
            >
              <option value="">Select…</option>
              {classroomsQ.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · Grade {c.grade}
                </option>
              ))}
            </select>
          </div>
        )}

        <label className="flex items-center gap-2 text-xs text-t2">
          <input type="checkbox" defaultChecked {...register("startNow")} />
          Start the meeting immediately (go live now)
        </label>
      </form>
    </Modal>
  );
}