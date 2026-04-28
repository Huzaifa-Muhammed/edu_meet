"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { UserUpdateSchema, type UserUpdateInput } from "@/shared/schemas/user.schema";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api/client";
import { toast } from "sonner";
import { Save } from "lucide-react";

export function ProfileForm() {
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<UserUpdateInput>({
    resolver: zodResolver(UserUpdateSchema),
    defaultValues: {
      displayName: user?.displayName ?? "",
      bio: user?.bio ?? "",
      subjects: user?.subjects ?? [],
    },
  });

  const mutation = useMutation({
    mutationFn: (data: UserUpdateInput) =>
      api.patch("/users/me", data) as Promise<unknown>,
    onSuccess: () => {
      toast.success("Profile updated");
      queryClient.invalidateQueries({ queryKey: ["user", "me"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <form
      onSubmit={handleSubmit((data) => mutation.mutate(data))}
      className="space-y-5"
    >
      {/* Avatar placeholder */}
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-panel text-xl font-semibold text-t2">
          {user?.displayName?.[0]?.toUpperCase() ?? "?"}
        </div>
        <div>
          <p className="text-sm font-semibold text-t">{user?.displayName}</p>
          <p className="text-xs text-t3">{user?.email}</p>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-t2">
          Display Name
        </label>
        <input
          {...register("displayName")}
          className="w-full rounded-lg border border-bd bg-surf px-3 py-2 text-sm text-t outline-none focus:border-acc"
        />
        {errors.displayName && (
          <p className="mt-1 text-xs text-red">{errors.displayName.message}</p>
        )}
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-t2">Bio</label>
        <textarea
          {...register("bio")}
          rows={4}
          className="w-full rounded-lg border border-bd bg-surf px-3 py-2 text-sm text-t outline-none focus:border-acc"
          placeholder="Tell your students about yourself..."
        />
        {errors.bio && (
          <p className="mt-1 text-xs text-red">{errors.bio.message}</p>
        )}
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
