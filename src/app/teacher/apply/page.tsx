"use client";
export const dynamic = "force-dynamic";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { LogOut } from "lucide-react";
import api from "@/lib/api/client";
import { signOut } from "@/lib/api/auth";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useAuth } from "@/providers/auth-provider";
import {
  TeacherApplicationCreateSchema,
  type TeacherApplicationCreateInput,
} from "@/shared/schemas/teacher-application.schema";
import type { TeacherApplication } from "@/shared/types/domain";

export default function TeacherApplyPage() {
  const router = useRouter();
  const { user, loading } = useCurrentUser();
  const { refreshUser } = useAuth();
  const queryClient = useQueryClient();

  const appQ = useQuery({
    queryKey: ["teacher", "application", "me"],
    queryFn: async () => {
      const res = (await api.get("/teacher/applications/me")) as unknown as {
        application: TeacherApplication | null;
      };
      return res.application;
    },
    enabled: !!user && user.role === "teacher",
    refetchInterval: 30_000,
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<TeacherApplicationCreateInput>({
    resolver: zodResolver(TeacherApplicationCreateSchema),
    defaultValues: {
      subject: "",
      yearsExperience: 0,
      highestDegree: "",
      bio: "",
    },
  });

  const submitMutation = useMutation({
    mutationFn: (data: TeacherApplicationCreateInput) =>
      api.post("/teacher/applications/me", data) as Promise<unknown>,
    onSuccess: () => {
      toast.success("Application submitted! An admin will review it shortly.");
      queryClient.invalidateQueries({ queryKey: ["teacher", "application", "me"] });
      queryClient.invalidateQueries({ queryKey: ["user", "me"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const liveStatus = appQ.data?.status ?? user?.applicationStatus;
  useEffect(() => {
    if (liveStatus === "approved") {
      // Pull a fresh user doc into AuthProvider state so the teacher layout
      // doesn't bounce us back here on its stale-status redirect.
      refreshUser().then(() => router.replace("/teacher/dashboard"));
    }
  }, [liveStatus, router, refreshUser]);

  async function onLogout() {
    await signOut();
    router.push("/auth/login");
  }

  if (loading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg">
        <p className="text-sm text-t3">Loading...</p>
      </div>
    );
  }

  const application = appQ.data;
  const status = application?.status ?? user.applicationStatus ?? "none";
  const showForm = status === "none" || status === "rejected";

  return (
    <div className="flex min-h-screen items-start justify-center bg-bg px-4 py-10">
      <div className="w-full max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-t">Teacher Application</h1>
            <p className="mt-1 text-sm text-t3">
              Tell us about yourself so the admin can verify your profile.
            </p>
          </div>
          <button
            onClick={onLogout}
            className="flex items-center gap-2 rounded-lg border border-bd bg-surf px-3 py-2 text-xs text-t2 hover:bg-panel"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </div>

        {status === "pending" && (
          <StatusBanner
            tone="amber"
            title="Application under review"
            description="An admin will review your details. You'll get access to the teacher portal as soon as you're approved."
          />
        )}
        {status === "rejected" && (
          <StatusBanner
            tone="red"
            title="Application rejected"
            description={
              application?.reviewNote
                ? `Note from admin: ${application.reviewNote}. You can edit and resubmit below.`
                : "You can edit and resubmit your application below."
            }
          />
        )}
        {status === "approved" && (
          <StatusBanner
            tone="green"
            title="You're approved"
            description="Redirecting you to the teacher portal…"
          />
        )}

        <div className="mt-6 rounded-2xl border border-bd bg-surf p-6 shadow-sm">
          {showForm ? (
            <form
              onSubmit={handleSubmit((d) => submitMutation.mutate(d))}
              className="space-y-5"
            >
              <div>
                <label className="mb-1 block text-xs font-medium text-t2">
                  Subject you want to teach
                </label>
                <input
                  type="text"
                  placeholder="e.g. Mathematics, Physics, English Literature"
                  className="w-full rounded-lg border border-bd bg-surf px-3 py-2 text-sm text-t outline-none focus:border-acc"
                  {...register("subject")}
                />
                {errors.subject && (
                  <p className="mt-1 text-xs text-red">{errors.subject.message}</p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-t2">
                  Years of experience
                </label>
                <input
                  type="number"
                  min={0}
                  placeholder="3"
                  className="w-full rounded-lg border border-bd bg-surf px-3 py-2 text-sm text-t outline-none focus:border-acc"
                  {...register("yearsExperience", { valueAsNumber: true })}
                />
                {errors.yearsExperience && (
                  <p className="mt-1 text-xs text-red">
                    {errors.yearsExperience.message}
                  </p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-t2">
                  Highest degree
                </label>
                <input
                  type="text"
                  placeholder="e.g. M.Sc. in Applied Mathematics"
                  className="w-full rounded-lg border border-bd bg-surf px-3 py-2 text-sm text-t outline-none focus:border-acc"
                  {...register("highestDegree")}
                />
                {errors.highestDegree && (
                  <p className="mt-1 text-xs text-red">
                    {errors.highestDegree.message}
                  </p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-t2">
                  Short bio (optional)
                </label>
                <textarea
                  rows={4}
                  placeholder="Briefly describe your teaching style, achievements, or anything else you'd like the admin to know."
                  className="w-full rounded-lg border border-bd bg-surf px-3 py-2 text-sm text-t outline-none focus:border-acc"
                  {...register("bio")}
                />
                {errors.bio && (
                  <p className="mt-1 text-xs text-red">{errors.bio.message}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting || submitMutation.isPending}
                className="w-full rounded-lg bg-acc py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {submitMutation.isPending
                  ? "Submitting..."
                  : status === "rejected"
                    ? "Resubmit application"
                    : "Submit application"}
              </button>
            </form>
          ) : application ? (
            <ApplicationSummary application={application} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function StatusBanner({
  tone,
  title,
  description,
}: {
  tone: "amber" | "red" | "green";
  title: string;
  description: string;
}) {
  const palette =
    tone === "amber"
      ? "border-abd bg-abg text-at"
      : tone === "red"
        ? "border-rbd bg-rbg text-rt"
        : "border-gbd bg-gbg text-gt";
  return (
    <div className={`rounded-xl border px-4 py-3 ${palette}`}>
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-1 text-xs opacity-90">{description}</p>
    </div>
  );
}

function ApplicationSummary({
  application,
}: {
  application: TeacherApplication;
}) {
  return (
    <div className="space-y-3 text-sm">
      <Row label="Subject" value={application.subject} />
      <Row label="Years of experience" value={`${application.yearsExperience} years`} />
      <Row label="Highest degree" value={application.highestDegree} />
      {application.bio && <Row label="Bio" value={application.bio} multiline />}
      <Row
        label="Submitted"
        value={new Date(application.submittedAt).toLocaleString()}
      />
    </div>
  );
}

function Row({
  label,
  value,
  multiline,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-xs font-medium text-t3">{label}</span>
      <span
        className={`text-right text-t ${multiline ? "max-w-md whitespace-pre-wrap" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}
