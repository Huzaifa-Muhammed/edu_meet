"use client";

import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api/client";
import { ProfileForm } from "@/components/teacher/profile-form";
import { SubjectPicker } from "@/components/shared/subject-picker";
import { useCurrentUser } from "@/hooks/use-current-user";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { LogOut, BookOpen, Video, Users } from "lucide-react";

type Profile = {
  uid: string;
  displayName?: string;
  email?: string;
  stats?: { totalMeetings: number; totalClassrooms: number };
};

export default function TeacherProfilePage() {
  const { user } = useCurrentUser();
  const router = useRouter();

  const { data: profile } = useQuery({
    queryKey: ["user", "profile", user?.uid],
    queryFn: () =>
      api.get(`/users/${user!.uid}/profile`) as unknown as Promise<Profile>,
    enabled: !!user?.uid,
  });

  async function logout() {
    await signOut(getFirebaseAuth());
    router.replace("/auth/login");
  }

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
            label="Classrooms"
            value={profile?.stats?.totalClassrooms ?? 0}
          />
          <StatCard
            icon={<Video className="h-4 w-4 text-t2" />}
            label="Classes held"
            value={profile?.stats?.totalMeetings ?? 0}
          />
          <StatCard
            icon={<Users className="h-4 w-4 text-t2" />}
            label="Subjects"
            value={user?.subjects?.length ?? 0}
          />
        </div>

        <div className="rounded-xl border border-bd bg-surf p-6">
          <h2 className="mb-4 text-sm font-semibold text-t">Personal info</h2>
          <ProfileForm />
        </div>

        <div className="rounded-xl border border-bd bg-surf p-6">
          <h2 className="mb-1 text-sm font-semibold text-t">Subjects you teach</h2>
          <p className="mb-4 text-xs text-t3">
            Students pick matching subjects to discover your classes on their dashboard.
          </p>
          <SubjectPicker
            selected={user?.subjects ?? []}
            onSave={async (subjects) => {
              await api.patch("/users/me/subjects", { subjects });
            }}
            invalidateUserQuery
          />
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
