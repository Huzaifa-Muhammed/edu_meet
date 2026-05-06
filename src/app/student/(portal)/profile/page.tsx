"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import api from "@/lib/api/client";
import { SubjectPicker } from "@/components/shared/subject-picker";
import { ChangePasswordForm } from "@/components/shared/change-password-form";
import { useCurrentUser } from "@/hooks/use-current-user";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { signOut } from "firebase/auth";
import { UserUpdateSchema, type UserUpdateInput } from "@/shared/schemas/user.schema";
import {
  BookOpen,
  ClipboardList,
  LogOut,
  Save,
  Mail,
  User as UserIcon,
} from "lucide-react";

type ClassesResponse = {
  subjects: string[];
  enrolled: Array<{ id: string; name: string }>;
  recommended: unknown[];
};

type StudentAssessment = {
  id: string;
  submitted: boolean;
  submissionStatus: "submitted" | "graded" | null;
  finalScore: number | null;
  totalPoints: number;
};

export default function StudentProfilePage() {
  const { user } = useCurrentUser();
  const router = useRouter();
  const qc = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<UserUpdateInput>({
    resolver: zodResolver(UserUpdateSchema) as unknown as import("react-hook-form").Resolver<UserUpdateInput>,
    values: {
      displayName: user?.displayName ?? "",
      bio: user?.bio ?? "",
    },
  });

  const classesQ = useQuery({
    queryKey: ["student", "classes"],
    queryFn: () =>
      api.get("/student/classes") as unknown as Promise<ClassesResponse>,
    enabled: !!user,
  });

  const assessmentsQ = useQuery({
    queryKey: ["student", "assessments"],
    queryFn: () =>
      api.get("/student/assessments") as unknown as Promise<StudentAssessment[]>,
    enabled: !!user,
  });

  const mutation = useMutation({
    mutationFn: (data: UserUpdateInput) =>
      api.patch("/users/me", data) as Promise<unknown>,
    onSuccess: (_, variables) => {
      toast.success("Profile updated");
      qc.invalidateQueries({ queryKey: ["user", "me"] });
      reset(variables);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  async function logout() {
    await signOut(getFirebaseAuth());
    router.replace("/auth/login");
  }

  const enrolled = classesQ.data?.enrolled.length ?? 0;
  const totalAssessments = assessmentsQ.data?.length ?? 0;
  const doneAssessments = assessmentsQ.data?.filter((a) => a.submitted).length ?? 0;

  // Avg score: graded only, across total points
  const gradedSubs = (assessmentsQ.data ?? []).filter(
    (a) => a.submissionStatus === "graded" && a.finalScore != null,
  );
  const avgPct =
    gradedSubs.length > 0
      ? Math.round(
          (gradedSubs.reduce((s, a) => s + ((a.finalScore ?? 0) / (a.totalPoints || 1)), 0) /
            gradedSubs.length) *
            100,
        )
      : null;

  return (
    <div className="flex-1 overflow-y-auto bg-bg p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-t">Profile & Settings</h1>
          <button
            onClick={logout}
            className="flex items-center gap-1.5 rounded-lg border border-bd px-3 py-1.5 text-xs font-medium text-t2 hover:bg-panel"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard
            icon={<BookOpen className="h-4 w-4 text-t2" />}
            label="Classes joined"
            value={enrolled}
          />
          <StatCard
            icon={<ClipboardList className="h-4 w-4 text-t2" />}
            label="Assessments done"
            value={`${doneAssessments}/${totalAssessments}`}
          />
          <StatCard
            icon={<UserIcon className="h-4 w-4 text-t2" />}
            label="Avg score"
            value={avgPct != null ? `${avgPct}%` : "—"}
          />
        </div>

        {/* Personal info */}
        <div className="rounded-xl border border-bd bg-surf p-6">
          <h2 className="mb-4 text-sm font-semibold text-t">Personal info</h2>

          <form
            onSubmit={handleSubmit((data) => mutation.mutate(data))}
            className="space-y-5"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-panel text-xl font-semibold text-t2">
                {user?.displayName?.[0]?.toUpperCase() ?? "?"}
              </div>
              <div>
                <p className="text-sm font-semibold text-t">{user?.displayName}</p>
                <p className="flex items-center gap-1 text-xs text-t3">
                  <Mail className="h-3 w-3" />
                  {user?.email}
                </p>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-t2">
                Display name
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
              <label className="mb-1 block text-xs font-medium text-t2">About me</label>
              <textarea
                {...register("bio")}
                rows={3}
                placeholder="Grade, interests, what you're working on…"
                className="w-full rounded-lg border border-bd bg-surf px-3 py-2 text-sm text-t outline-none focus:border-acc"
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
        </div>

        {/* Subjects */}
        <div className="rounded-xl border border-bd bg-surf p-6">
          <h2 className="mb-1 text-sm font-semibold text-t">My subjects</h2>
          <p className="mb-4 text-xs text-t3">
            We'll show you classes matching these. You can type custom subjects too.
          </p>
          <SubjectPicker
            selected={user?.subjects ?? []}
            onSave={async (subjects) => {
              await api.patch("/users/me/subjects", { subjects });
            }}
            invalidateUserQuery
          />
        </div>

        {/* Security */}
        <div className="rounded-xl border border-bd bg-surf p-6">
          <h2 className="mb-1 text-sm font-semibold text-t">Security</h2>
          <p className="mb-4 text-xs text-t3">
            Change your account password. You&apos;ll need your current password
            to confirm.
          </p>
          <ChangePasswordForm />
        </div>

        {/* Enrolled classes quick view */}
        <div className="rounded-xl border border-bd bg-surf p-6">
          <h2 className="mb-3 text-sm font-semibold text-t">My classes</h2>
          {classesQ.data?.enrolled.length ? (
            <div className="space-y-1.5">
              {classesQ.data.enrolled.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-3 rounded-lg border border-bd bg-panel/40 px-3 py-2"
                >
                  <BookOpen className="h-3.5 w-3.5 text-t3" />
                  <span className="text-xs font-medium text-t">{c.name}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-t3">
              You haven't joined any classes yet. Go to your dashboard to see recommended
              classes in your subjects.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-xl border border-bd bg-surf p-4">
      <div className="mb-1.5 flex items-center gap-2">
        {icon}
        <span className="text-[10px] font-semibold uppercase tracking-wider text-t3">
          {label}
        </span>
      </div>
      <p className="text-xl font-bold text-t">{value}</p>
    </div>
  );
}
