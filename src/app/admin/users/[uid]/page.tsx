"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  ShieldCheck,
  ShieldX,
  Mail,
  Calendar,
  GraduationCap,
} from "lucide-react";
import api from "@/lib/api/client";
import { TeacherCredentials } from "@/components/shared/teacher-credentials";
import type { User } from "@/shared/types/domain";

type DetailResponse = User & {
  stats?: {
    totalClassrooms?: number;
    totalMeetings?: number;
    totalSubmissions?: number;
    balance?: number;
  };
};

export default function AdminUserDetailPage() {
  const router = useRouter();
  const params = useParams<{ uid: string }>();
  const uid = params?.uid;
  const queryClient = useQueryClient();

  const userQ = useQuery({
    queryKey: ["admin", "user", uid],
    queryFn: () => api.get(`/admin/users/${uid}`) as Promise<DetailResponse>,
    enabled: !!uid,
  });

  const blockMutation = useMutation({
    mutationFn: ({
      blocked,
      reason,
    }: {
      blocked: boolean;
      reason?: string;
    }) =>
      api.post(`/admin/users/${uid}/block`, {
        blocked,
        reason,
      }) as Promise<unknown>,
    onSuccess: (_d, vars) => {
      toast.success(vars.blocked ? "User blocked" : "User unblocked");
      queryClient.invalidateQueries({ queryKey: ["admin", "user", uid] });
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "overview"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function handleBlockToggle() {
    if (!u) return;
    if (u.blocked) {
      blockMutation.mutate({ blocked: false });
      return;
    }
    const input = window.prompt(
      `Block ${u.displayName || u.email}?\n\nOptional reason — included in the email sent to this user. Leave blank to send a generic notice.`,
      "",
    );
    if (input === null) return;
    const reason = input.trim();
    blockMutation.mutate({
      blocked: true,
      reason: reason.length > 0 ? reason : undefined,
    });
  }

  const u = userQ.data;
  const initials =
    u?.displayName
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() ?? "?";

  return (
    <div className="bg-bg p-6">
      <div className="mx-auto max-w-3xl space-y-4">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-xs text-t3 hover:text-t"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </button>

        {userQ.isLoading || !u ? (
          <div className="h-48 animate-pulse rounded-2xl border border-bd bg-panel" />
        ) : (
          <>
            <div className="rounded-2xl border border-bd bg-surf p-6">
              <div className="flex items-center gap-4">
                <div
                  className="flex h-16 w-16 items-center justify-center rounded-full text-base font-bold text-white"
                  style={{
                    background: "linear-gradient(135deg,#38BDF8,#0EA5E9)",
                  }}
                >
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-lg font-semibold text-t">
                      {u.displayName ?? u.email}
                    </h1>
                    <span className="rounded-full border border-bbd bg-bbg px-2 py-0.5 text-[10px] font-bold capitalize text-bt">
                      {u.role}
                    </span>
                    {u.blocked && (
                      <span className="rounded-full border border-rbd bg-rbg px-2 py-0.5 text-[10px] font-bold text-rt">
                        Blocked
                      </span>
                    )}
                  </div>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-t3">
                    <Mail className="h-3 w-3" />
                    {u.email}
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-t3">
                    <Calendar className="h-3 w-3" />
                    Joined {new Date(u.createdAt).toLocaleDateString()}
                  </p>
                </div>

                <button
                  onClick={handleBlockToggle}
                  disabled={blockMutation.isPending}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors disabled:opacity-50 ${
                    u.blocked
                      ? "border border-gbd bg-gbg text-gt"
                      : "border border-rbd bg-rbg text-rt"
                  }`}
                >
                  {u.blocked ? (
                    <>
                      <ShieldCheck className="h-3.5 w-3.5" /> Unblock
                    </>
                  ) : (
                    <>
                      <ShieldX className="h-3.5 w-3.5" /> Block
                    </>
                  )}
                </button>
              </div>

              {u.bio && (
                <div className="mt-5 rounded-xl border border-bd bg-panel p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-t3">
                    Bio
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-t">
                    {u.bio}
                  </p>
                </div>
              )}

              {u.subjects && u.subjects.length > 0 && (
                <div className="mt-3 rounded-xl border border-bd bg-panel p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-t3">
                    Subjects
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {u.subjects.map((s) => (
                      <span
                        key={s}
                        className="rounded-full border border-bd bg-surf px-2 py-0.5 text-[11px] text-t2"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {u.blocked && u.blockReason && (
                <div className="mt-3 rounded-xl border border-rbd bg-rbg p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-rt">
                    Block reason
                  </p>
                  <p className="mt-1 text-sm text-t">{u.blockReason}</p>
                </div>
              )}
            </div>

            {/* Stats */}
            {u.stats && (
              <div className="grid gap-3 sm:grid-cols-3">
                {u.role === "teacher" && (
                  <>
                    <Stat label="Classrooms" value={u.stats.totalClassrooms ?? 0} />
                    <Stat label="Meetings" value={u.stats.totalMeetings ?? 0} />
                    <Stat
                      label="Application"
                      value={u.applicationStatus ?? "none"}
                      capitalize
                    />
                  </>
                )}
                {u.role === "student" && (
                  <>
                    <Stat label="Classrooms" value={u.stats.totalClassrooms ?? 0} />
                    <Stat label="Submissions" value={u.stats.totalSubmissions ?? 0} />
                    <Stat label="Brain tokens" value={u.stats.balance ?? 0} />
                  </>
                )}
              </div>
            )}

            {u.role === "teacher" &&
              !!(
                u.experiences?.length ||
                u.certifications?.length ||
                u.degrees?.length
              ) && (
                <div className="rounded-2xl border border-bd bg-surf p-6">
                  <h2 className="mb-3 text-sm font-semibold text-t">
                    Credentials
                  </h2>
                  <TeacherCredentials
                    experiences={u.experiences}
                    certifications={u.certifications}
                    degrees={u.degrees}
                  />
                </div>
              )}

            {u.role === "teacher" && u.applicationStatus !== "approved" && (
              <Link
                href="/admin/applications"
                className="flex items-center gap-2 rounded-xl border border-bd bg-surf p-4 text-sm text-t hover:bg-panel"
              >
                <GraduationCap className="h-4 w-4 text-pt" />
                Review this teacher&apos;s application →
              </Link>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  capitalize,
}: {
  label: string;
  value: number | string;
  capitalize?: boolean;
}) {
  return (
    <div className="rounded-xl border border-bd bg-surf p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-t3">
        {label}
      </p>
      <p
        className={`mt-1 text-xl font-bold text-t ${capitalize ? "capitalize" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}
