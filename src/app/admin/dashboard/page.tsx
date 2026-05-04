"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  Users,
  GraduationCap,
  ShieldX,
  Inbox,
  LifeBuoy,
  Video,
  ArrowRight,
} from "lucide-react";

type Overview = {
  totalUsers: number;
  teachers: number;
  students: number;
  blocked: number;
  pendingApplications: number;
  openTickets: number;
  classrooms: number;
};

export default function AdminDashboardPage() {
  const { user } = useCurrentUser();
  const overviewQ = useQuery({
    queryKey: ["admin", "overview"],
    queryFn: () => api.get("/admin/overview") as Promise<Overview>,
    refetchInterval: 60_000,
  });

  const o = overviewQ.data;

  return (
    <div className="bg-bg p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <h1 className="text-lg font-semibold text-t">
            Welcome back, {user?.displayName?.split(" ")[0] ?? "Admin"}
          </h1>
          <p className="text-xs text-t3">
            Snapshot of who&apos;s on the platform and what needs your attention.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            icon={<Users className="h-4 w-4" />}
            tone="blue"
            label="Total users"
            value={o?.totalUsers ?? "—"}
            sub={
              o
                ? `${o.teachers} teachers · ${o.students} students`
                : "Loading…"
            }
          />
          <Stat
            icon={<GraduationCap className="h-4 w-4" />}
            tone="amber"
            label="Pending applications"
            value={o?.pendingApplications ?? "—"}
            sub="Teachers awaiting review"
            href="/admin/applications"
          />
          <Stat
            icon={<LifeBuoy className="h-4 w-4" />}
            tone="purple"
            label="Open reports"
            value={o?.openTickets ?? "—"}
            sub="Student support tickets"
            href="/admin/reports"
          />
          <Stat
            icon={<ShieldX className="h-4 w-4" />}
            tone="red"
            label="Blocked users"
            value={o?.blocked ?? "—"}
            sub="Currently locked out"
            href="/admin/users"
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Quick actions" icon={<Inbox className="h-4 w-4" />}>
            <div className="grid gap-2">
              <ActionRow
                href="/admin/applications"
                title="Review teacher applications"
                desc="Approve or reject incoming teacher signups."
                badge={o?.pendingApplications}
                badgeTone="amber"
              />
              <ActionRow
                href="/admin/users"
                title="Manage users"
                desc="View profiles, block or unblock accounts."
              />
              <ActionRow
                href="/admin/reports"
                title="Inspect support reports"
                desc="Read student-submitted issues and resolve them."
                badge={o?.openTickets}
                badgeTone="purple"
              />
            </div>
          </Card>

          <Card title="Platform" icon={<Video className="h-4 w-4" />}>
            <div className="grid grid-cols-2 gap-3">
              <PlatformCell label="Teachers" value={o?.teachers ?? "—"} />
              <PlatformCell label="Students" value={o?.students ?? "—"} />
              <PlatformCell label="Classrooms" value={o?.classrooms ?? "—"} />
              <PlatformCell label="Blocked" value={o?.blocked ?? "—"} />
            </div>
            <p className="mt-3 text-[11px] text-t3">
              Counts refresh every minute. Numbers reflect live Firestore state.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  sub,
  tone,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  sub: string;
  tone: "blue" | "amber" | "purple" | "red";
  href?: string;
}) {
  const tones: Record<string, string> = {
    blue: "text-bt bg-bbg border-bbd",
    amber: "text-at bg-abg border-abd",
    purple: "text-pt bg-pbg border-pbd",
    red: "text-rt bg-rbg border-rbd",
  };
  const Inner = (
    <div className="rounded-2xl border border-bd bg-surf p-4 transition-colors hover:bg-panel2">
      <div className="mb-2 flex items-center justify-between">
        <span
          className={`flex h-7 w-7 items-center justify-center rounded-lg border ${tones[tone]}`}
        >
          {icon}
        </span>
        {href && <ArrowRight className="h-3.5 w-3.5 text-t3" />}
      </div>
      <p className="text-2xl font-bold text-t">{value}</p>
      <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-t3">
        {label}
      </p>
      <p className="mt-1 text-[11px] text-t2">{sub}</p>
    </div>
  );
  return href ? <Link href={href}>{Inner}</Link> : Inner;
}

function Card({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-bd bg-surf p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-panel2 text-t2">
          {icon}
        </span>
        <p className="text-sm font-semibold text-t">{title}</p>
      </div>
      {children}
    </div>
  );
}

function ActionRow({
  href,
  title,
  desc,
  badge,
  badgeTone,
}: {
  href: string;
  title: string;
  desc: string;
  badge?: number;
  badgeTone?: "amber" | "purple";
}) {
  const tones: Record<string, string> = {
    amber: "bg-abg text-at border-abd",
    purple: "bg-pbg text-pt border-pbd",
  };
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-xl border border-bd bg-panel px-3 py-3 transition-colors hover:bg-panel2"
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold text-t">{title}</p>
        <p className="mt-0.5 truncate text-[11px] text-t3">{desc}</p>
      </div>
      <div className="flex items-center gap-2">
        {badge != null && badge > 0 && badgeTone && (
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${tones[badgeTone]}`}
          >
            {badge}
          </span>
        )}
        <ArrowRight className="h-3.5 w-3.5 text-t3" />
      </div>
    </Link>
  );
}

function PlatformCell({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-xl border border-bd bg-panel px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-t3">
        {label}
      </p>
      <p className="mt-1 text-lg font-bold text-t">{value}</p>
    </div>
  );
}
