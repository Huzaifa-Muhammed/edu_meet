"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Search,
  ShieldX,
  ShieldCheck,
  GraduationCap,
  User as UserIcon,
} from "lucide-react";
import api from "@/lib/api/client";
import type { User } from "@/shared/types/domain";

type Role = "all" | "teacher" | "student";

export default function AdminUsersPage() {
  const [role, setRole] = useState<Role>("all");
  const [query, setQuery] = useState("");
  const queryClient = useQueryClient();

  const usersQ = useQuery({
    queryKey: ["admin", "users", role],
    queryFn: () => {
      const path = role === "all" ? "/admin/users" : `/admin/users?role=${role}`;
      return api.get(path) as Promise<User[]>;
    },
  });

  const blockMutation = useMutation({
    mutationFn: ({ uid, blocked }: { uid: string; blocked: boolean }) =>
      api.post(`/admin/users/${uid}/block`, { blocked }) as Promise<unknown>,
    onSuccess: (_data, vars) => {
      toast.success(vars.blocked ? "User blocked" : "User unblocked");
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "overview"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const filtered = useMemo(() => {
    let list = usersQ.data ?? [];
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (u) =>
          (u.displayName ?? "").toLowerCase().includes(q) ||
          (u.email ?? "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [usersQ.data, query]);

  return (
    <div className="bg-bg p-6">
      <div className="mx-auto max-w-6xl space-y-4">
        <div>
          <h1 className="text-lg font-semibold text-t">All users</h1>
          <p className="text-xs text-t3">
            View profiles, search by name or email, and block accounts when needed.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-lg border border-bd bg-surf px-3 py-2">
            <Search className="h-3.5 w-3.5 text-t3" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or email…"
              className="flex-1 bg-transparent text-xs text-t outline-none placeholder:text-t3"
            />
          </div>
          <div className="flex gap-1 rounded-lg bg-panel p-1">
            {(["all", "teacher", "student"] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRole(r)}
                className={`rounded-md px-3 py-1 text-[11px] font-medium capitalize ${
                  role === r ? "bg-surf text-t shadow-sm" : "text-t3"
                }`}
              >
                {r === "all" ? "All" : `${r}s`}
              </button>
            ))}
          </div>
        </div>

        {usersQ.isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-16 animate-pulse rounded-xl border border-bd bg-panel"
              />
            ))}
          </div>
        ) : !filtered.length ? (
          <div className="rounded-xl border border-bd bg-surf p-8 text-center">
            <p className="text-sm font-semibold text-t">No users match</p>
            <p className="mt-1 text-xs text-t3">
              Try a different search term or role filter.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((u) => (
              <UserRow
                key={u.uid}
                user={u}
                onBlockToggle={() =>
                  blockMutation.mutate({
                    uid: u.uid,
                    blocked: !u.blocked,
                  })
                }
                pending={blockMutation.isPending}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function UserRow({
  user,
  onBlockToggle,
  pending,
}: {
  user: User;
  onBlockToggle: () => void;
  pending: boolean;
}) {
  const initials =
    user.displayName
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() ?? "?";

  return (
    <div className="flex items-center gap-4 rounded-xl border border-bd bg-surf p-4">
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-panel2 text-xs font-bold text-t">
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold text-t">
            {user.displayName ?? user.email}
          </p>
          <RoleBadge role={user.role} />
          {user.blocked && (
            <span className="rounded-full border border-rbd bg-rbg px-2 py-0.5 text-[10px] font-bold text-rt">
              Blocked
            </span>
          )}
          {user.role === "teacher" &&
            user.applicationStatus &&
            user.applicationStatus !== "approved" && (
              <span className="rounded-full border border-abd bg-abg px-2 py-0.5 text-[10px] font-bold capitalize text-at">
                {user.applicationStatus}
              </span>
            )}
        </div>
        <p className="truncate text-[11px] text-t3">{user.email}</p>
      </div>

      <div className="flex items-center gap-2">
        <Link
          href={`/admin/users/${user.uid}`}
          className="rounded-lg border border-bd bg-panel px-3 py-1.5 text-[11px] font-medium text-t2 hover:bg-panel2"
        >
          View
        </Link>
        <button
          onClick={onBlockToggle}
          disabled={pending}
          className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-colors disabled:opacity-50 ${
            user.blocked
              ? "border border-gbd bg-gbg text-gt hover:opacity-90"
              : "border border-rbd bg-rbg text-rt hover:opacity-90"
          }`}
          title={user.blocked ? "Unblock user" : "Block user"}
        >
          {user.blocked ? (
            <>
              <ShieldCheck className="h-3 w-3" />
              Unblock
            </>
          ) : (
            <>
              <ShieldX className="h-3 w-3" />
              Block
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  const map: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
    teacher: {
      label: "Teacher",
      cls: "border-pbd bg-pbg text-pt",
      icon: <GraduationCap className="h-3 w-3" />,
    },
    student: {
      label: "Student",
      cls: "border-bbd bg-bbg text-bt",
      icon: <UserIcon className="h-3 w-3" />,
    },
    admin: {
      label: "Admin",
      cls: "border-bbd bg-bbg text-bt",
      icon: <UserIcon className="h-3 w-3" />,
    },
  };
  const r = map[role] ?? map.student;
  return (
    <span
      className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${r.cls}`}
    >
      {r.icon}
      {r.label}
    </span>
  );
}
