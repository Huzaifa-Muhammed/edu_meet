"use client";

import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Save } from "lucide-react";
import api from "@/lib/api/client";
import { useAuth } from "@/providers/auth-provider";
import { UserUpdateSchema, type UserUpdateInput } from "@/shared/schemas/user.schema";
import {
  GradeMultiSelect,
  SyllabusMultiSelect,
} from "@/components/shared/syllabus-select";

/** Lets an approved teacher edit the grade levels + exam boards they teach.
 *  These seed the class-creation board default and drive AI-schedule matching,
 *  so existing teachers (who applied before boards existed) can set them here. */
export function TeachingPrefsForm() {
  const { user, refreshUser } = useAuth();
  const qc = useQueryClient();

  const {
    control,
    setValue,
    handleSubmit,
    reset,
    formState: { isDirty },
  } = useForm<UserUpdateInput>({
    resolver: zodResolver(UserUpdateSchema) as unknown as import("react-hook-form").Resolver<UserUpdateInput>,
    values: {
      applicationGrades: user?.applicationGrades ?? [],
      applicationSyllabi: user?.applicationSyllabi ?? [],
    },
  });

  const grades = useWatch({ control, name: "applicationGrades" }) ?? [];
  const syllabi = useWatch({ control, name: "applicationSyllabi" }) ?? [];

  const mutation = useMutation({
    mutationFn: (data: UserUpdateInput) =>
      api.patch("/users/me", {
        applicationGrades: data.applicationGrades ?? [],
        applicationSyllabi: data.applicationSyllabi ?? [],
      }) as Promise<unknown>,
    onSuccess: async (_, variables) => {
      toast.success("Teaching preferences updated");
      qc.invalidateQueries({ queryKey: ["user", "me"] });
      await refreshUser();
      reset(variables);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="space-y-5">
      <div>
        <label className="mb-2 block text-xs font-medium text-t2">
          Grade levels you teach
        </label>
        <GradeMultiSelect
          value={grades}
          onChange={(v) => setValue("applicationGrades", v, { shouldDirty: true })}
        />
      </div>

      <div>
        <label className="mb-2 block text-xs font-medium text-t2">
          Exam boards you teach
        </label>
        <SyllabusMultiSelect
          value={syllabi}
          onChange={(v) => setValue("applicationSyllabi", v, { shouldDirty: true })}
        />
      </div>

      <button
        type="submit"
        disabled={!isDirty || mutation.isPending}
        className="flex items-center gap-2 rounded-lg bg-acc px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        <Save className="h-4 w-4" />
        {mutation.isPending ? "Saving..." : "Save changes"}
      </button>
    </form>
  );
}
