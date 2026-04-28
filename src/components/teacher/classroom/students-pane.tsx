"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useMeeting, usePubSub } from "@videosdk.live/react-sdk";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "@/lib/api/client";
import {
  Search,
  MicOff,
  VideoOff,
  Star,
  Users as UsersIcon,
  UserMinus,
} from "lucide-react";
import { RewardModal, type RewardKind } from "./reward-modal";
import { RewardBroadcast, rewardColor, type BroadcastPayload } from "./reward-broadcast";

type LeaderboardEntry = { id: string; name: string; pts: number; emoji: string };

type Student = { uid: string; displayName?: string; email?: string; photoUrl?: string };
type Filter = "all" | "hands" | "away" | "muted";
type View = "list" | "groups";
type Lane = "attn" | "ok" | "pool";

export function StudentsPane({
  classroomId,
  meetingId,
}: {
  classroomId: string;
  meetingId: string;
}) {
  const { participants } = useMeeting();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Filter>("all");
  const [view, setView] = useState<View>("list");
  const [query, setQuery] = useState("");
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [rewardOpen, setRewardOpen] = useState(false);
  const [rewardTarget, setRewardTarget] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [broadcast, setBroadcast] = useState<BroadcastPayload | null>(null);
  const [laneMap, setLaneMap] = useState<Map<string, Lane>>(new Map());
  const dragIdRef = useRef<string | null>(null);

  // Reward broadcast pubsub — everyone in class sees the confetti
  const { publish: publishReward, messages: rewardMsgs } = usePubSub("REWARD");

  // STUDENT_KICK — instant signal so the kicked student leaves immediately;
  // the durable bannedUids field on the meeting prevents rejoin.
  const { publish: publishKick } = usePubSub("STUDENT_KICK");

  const kickMut = useMutation({
    mutationFn: (uid: string) =>
      api.post(`/meetings/${meetingId}/kick`, { uid, banned: true }),
    onSuccess: (_data, uid) => {
      const target = students?.find((s) => s.uid === uid);
      const name = target?.displayName ?? target?.email ?? "Student";
      publishKick(
        JSON.stringify({ uid, name, by: "teacher", at: Date.now() }),
        { persist: true },
      );
      toast.success(`${name} removed from class`);
      qc.invalidateQueries({ queryKey: ["classroom-students", classroomId] });
    },
    onError: (err: Error) => toast.error(err.message ?? "Could not remove student"),
  });

  const onKickClick = (uid: string, name: string) => {
    if (kickMut.isPending) return;
    if (!window.confirm(`Remove ${name} from this class?`)) return;
    kickMut.mutate(uid);
  };

  // Render broadcast from any incoming REWARD pubsub (teacher sees own too)
  useEffect(() => {
    const last = rewardMsgs[rewardMsgs.length - 1];
    if (!last) return;
    try {
      const p = JSON.parse(last.message as unknown as string) as BroadcastPayload & {
        broadcastId?: string;
      };
      setBroadcast({ ...p, id: p.broadcastId ?? crypto.randomUUID() });
    } catch {
      // malformed
    }
  }, [rewardMsgs.length]);

  const { data: students } = useQuery({
    queryKey: ["classroom-students", classroomId],
    queryFn: () =>
      api.get(`/classrooms/${classroomId}/students`) as unknown as Promise<Student[]>,
    enabled: !!classroomId,
  });

  const rows = useMemo(() => {
    const all = students ?? [];
    return all.map((s) => {
      const p = participants.get(s.uid) as unknown as
        | { micOn?: boolean; webcamOn?: boolean }
        | undefined;
      const isLive = !!p;
      const micOn = p?.micOn ?? false;
      return { ...s, live: isLive, micOn };
    });
  }, [students, participants]);

  const filtered = rows.filter((r) => {
    const q = query.trim().toLowerCase();
    if (q && !(r.displayName ?? r.email ?? "").toLowerCase().includes(q)) return false;
    if (filter === "away" && r.live) return false;
    if (filter === "muted" && r.micOn) return false;
    return true;
  });

  const total = rows.length;
  const attentive = rows.filter((r) => r.live).length;
  const away = rows.filter((r) => !r.live).length;
  const muted = rows.filter((r) => r.live && !r.micOn).length;

  const toggleAll = () => {
    if (checked.size === filtered.length) setChecked(new Set());
    else setChecked(new Set(filtered.map((r) => r.uid)));
  };

  const toggleOne = (uid: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-surf">
      {/* Toolbar */}
      <div className="flex flex-shrink-0 items-center gap-1.5 border-b border-bd bg-surf px-2.5 py-1.5">
        <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md border border-bd bg-panel px-2.5 py-1">
          <Search className="h-3 w-3 flex-shrink-0 text-t3" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            className="min-w-0 flex-1 border-none bg-transparent text-[12px] text-t outline-none placeholder:text-t3"
          />
        </div>
        {(["all", "hands", "away", "muted"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex-shrink-0 rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors ${
              filter === f
                ? "border-acc bg-acc text-white"
                : "border-bd bg-transparent text-t2 hover:bg-panel"
            }`}
          >
            {f === "hands" ? "✋" : f[0].toUpperCase() + f.slice(1)}
          </button>
        ))}

        <div className="mx-1 h-4 w-px bg-bd" />

        <button
          onClick={() => {
            setRewardTarget(null);
            setRewardOpen(true);
          }}
          className="flex flex-shrink-0 items-center gap-1 rounded-md border border-yellow-300 bg-yellow-50 px-2 py-1 text-[11px] font-medium text-yellow-800 hover:bg-yellow-100"
        >
          <Star className="h-3 w-3" /> Reward
        </button>

        <div className="mx-1 h-4 w-px bg-bd" />

        <button className="flex flex-shrink-0 items-center gap-1 rounded-md border border-bd bg-surf px-2 py-1 text-[11px] font-medium text-t2 hover:bg-panel">
          <MicOff className="h-3 w-3" /> Mute all
        </button>
        <button className="flex flex-shrink-0 items-center gap-1 rounded-md border border-bd bg-surf px-2 py-1 text-[11px] font-medium text-t2 hover:bg-panel">
          <VideoOff className="h-3 w-3" /> Cam off
        </button>

        <div className="mx-1 h-4 w-px bg-bd" />

        <div className="flex flex-shrink-0 overflow-hidden rounded-md border border-bd">
          <button
            onClick={() => setView("list")}
            className={`px-2.5 py-1 text-[11px] font-medium ${
              view === "list" ? "bg-acc text-white" : "bg-surf text-t2 hover:bg-panel"
            }`}
          >
            List
          </button>
          <button
            onClick={() => setView("groups")}
            className={`px-2.5 py-1 text-[11px] font-medium ${
              view === "groups" ? "bg-acc text-white" : "bg-surf text-t2 hover:bg-panel"
            }`}
          >
            Groups
          </button>
        </div>
      </div>

      {/* Selection bar */}
      {checked.size > 0 && (
        <div className="flex flex-shrink-0 items-center gap-2 border-b border-bd bg-accbg px-3 py-1.5">
          <span className="text-[11px] font-medium text-acc">
            <strong>{checked.size}</strong> selected
          </span>
          <button
            onClick={() => setChecked(new Set())}
            className="rounded-md border border-bd2 bg-surf px-2 py-0.5 text-[10px] font-medium text-t2 hover:bg-panel"
          >
            ✕ Clear
          </button>
          <button className="ml-auto flex items-center gap-1 rounded-md bg-acc px-2.5 py-1 text-[10px] font-medium text-white">
            <UsersIcon className="h-3 w-3" /> Create Breakout Room
          </button>
        </div>
      )}

      {/* Leaderboard strip */}
      {leaderboard.length > 0 && (
        <div
          className="flex flex-shrink-0 items-center gap-2 border-b border-bd px-3 py-1.5"
          style={{ background: "linear-gradient(90deg, #FEF3C7, #FEF9C3)" }}
        >
          <span className="flex-shrink-0 text-[10px] font-semibold uppercase tracking-[.3px] text-amber-900">
            🏆 Leaderboard
          </span>
          <div className="flex flex-1 flex-wrap gap-1">
            {leaderboard
              .sort((a, b) => b.pts - a.pts)
              .slice(0, 6)
              .map((e) => (
                <span
                  key={e.id}
                  className="inline-flex items-center gap-1 rounded-full border border-yellow-300 bg-white/70 px-2 py-0.5 text-[10px] font-medium text-amber-900"
                >
                  {e.emoji} {e.name} <strong>{e.pts}</strong>
                </span>
              ))}
          </div>
          <button
            onClick={() => setLeaderboard([])}
            className="flex-shrink-0 rounded-md border border-yellow-300 bg-white/50 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 hover:bg-white/80"
          >
            ✕ Clear
          </button>
        </div>
      )}

      {/* Stats bar */}
      <div className="grid flex-shrink-0 grid-cols-6 gap-1.5 border-b border-bd bg-panel px-3 py-2">
        <StatCard dot="var(--t3)" num={total} label="Total" />
        <StatCard dot="var(--green)" num={attentive} label="Attentive" color="var(--green)" />
        <StatCard dot="var(--amber)" num={0} label="Hands" color="var(--amber)" />
        <StatCard dot="var(--red)" num={away} label="Away" color="var(--red)" />
        <StatCard dot="var(--blue)" num={muted} label="Muted" color="var(--blue)" />
        <StatCard dot="var(--purple)" num={0} label="Avg" color="var(--purple)" />
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {view === "list" && (
          <>
            <div className="sticky top-0 z-10 grid grid-cols-[30px_1fr_90px_60px_40px_80px] gap-2 border-b border-bd bg-panel px-3 py-1 text-[9px] font-bold uppercase tracking-[.4px] text-t3">
              <input
                type="checkbox"
                checked={checked.size === filtered.length && filtered.length > 0}
                onChange={toggleAll}
                className="h-3 w-3 accent-blue-600"
                aria-label="Select all"
              />
              <span>Student</span>
              <span className="text-center">Status</span>
              <span className="text-right">Score</span>
              <span className="text-center">⭐ Pts</span>
              <span className="text-center">Controls</span>
            </div>
            <div className="p-2">
              {filtered.map((r) => (
                <StudentRow
                  key={r.uid}
                  row={r}
                  checked={checked.has(r.uid)}
                  onToggle={() => toggleOne(r.uid)}
                  points={leaderboard.find((l) => l.id === r.uid)?.pts ?? 0}
                  onReward={() => {
                    setRewardTarget(r.uid);
                    setRewardOpen(true);
                  }}
                  onKick={() =>
                    onKickClick(r.uid, r.displayName ?? r.email ?? "Student")
                  }
                  kicking={kickMut.isPending}
                />
              ))}
              {filtered.length === 0 && (
                <div className="flex flex-col items-center gap-2 py-10 text-center text-[11px] text-t3">
                  <UsersIcon className="h-6 w-6" />
                  <span>No students match</span>
                </div>
              )}
            </div>
          </>
        )}

        {view === "groups" && (
          <div className="space-y-2 p-3">
            {(
              [
                { id: "attn" as Lane, color: "var(--red)", name: "Needs attention" },
                { id: "ok" as Lane, color: "var(--green)", name: "On track" },
                { id: "pool" as Lane, color: "var(--t3)", name: "Unassigned" },
              ]
            ).map((lane) => {
              const members = filtered.filter(
                (r) => (laneMap.get(r.uid) ?? "pool") === lane.id,
              );
              return (
                <LaneDropZone
                  key={lane.id}
                  color={lane.color}
                  name={lane.name}
                  count={members.length}
                  onDrop={() => {
                    const id = dragIdRef.current;
                    if (!id) return;
                    setLaneMap((prev) => {
                      const n = new Map(prev);
                      n.set(id, lane.id);
                      return n;
                    });
                    dragIdRef.current = null;
                  }}
                >
                  {members.map((r) => {
                    const name = r.displayName ?? r.email ?? "?";
                    return (
                      <div
                        key={r.uid}
                        draggable
                        onDragStart={() => {
                          dragIdRef.current = r.uid;
                        }}
                        onDragEnd={() => {
                          dragIdRef.current = null;
                        }}
                        className="inline-flex cursor-grab items-center gap-1.5 rounded-full border border-bd bg-surf px-2 py-0.5 text-[11px] font-medium text-t2 transition-colors hover:border-bd2 active:cursor-grabbing"
                      >
                        <div className="flex h-4 w-4 items-center justify-center rounded-full bg-panel2 text-[8px] font-bold">
                          {name.slice(0, 2).toUpperCase()}
                        </div>
                        {name}
                      </div>
                    );
                  })}
                </LaneDropZone>
              );
            })}
          </div>
        )}
      </div>

      {/* Reward modal */}
      <RewardModal
        open={rewardOpen}
        onClose={() => setRewardOpen(false)}
        defaultStudentId={rewardTarget ?? undefined}
        students={rows.map((r) => ({
          id: r.uid,
          name: r.displayName ?? r.email ?? "Student",
        }))}
        onAward={({ studentId, reward, note }) => {
          const target = rows.find((r) => r.uid === studentId);
          if (!target) return;
          const name = target.displayName ?? target.email ?? "Student";
          setLeaderboard((prev) => {
            const existing = prev.find((p) => p.id === studentId);
            if (existing) {
              return prev.map((p) =>
                p.id === studentId ? { ...p, pts: p.pts + reward.pts, emoji: reward.emoji } : p,
              );
            }
            return [
              ...prev,
              { id: studentId, name, pts: reward.pts, emoji: reward.emoji },
            ];
          });
          const payload: BroadcastPayload = {
            id: crypto.randomUUID(),
            name,
            initials: name.slice(0, 2).toUpperCase(),
            avBg: rewardColor(reward.kind as RewardKind),
            rewardEmoji: reward.emoji,
            rewardLabel: reward.label,
            note,
          };
          // Broadcast — everyone (including self) renders via the pubsub listener
          publishReward(JSON.stringify({ ...payload, broadcastId: payload.id }), {
            persist: false,
          });
          // Server-side BT credit + ledger entry
          api
            .post(`/classrooms/${classroomId}/rewards`, {
              studentUid: studentId,
              pts: reward.pts,
              label: reward.label,
              emoji: reward.emoji,
              note,
            })
            .catch(() => {
              /* confetti already shown; ledger failure is non-fatal */
            });
        }}
      />

      {/* Broadcast overlay */}
      <RewardBroadcast payload={broadcast} onDone={() => setBroadcast(null)} />
    </div>
  );
}

function StudentRow({
  row,
  checked,
  onToggle,
  points,
  onReward,
  onKick,
  kicking,
}: {
  row: { uid: string; displayName?: string; email?: string; live: boolean; micOn: boolean };
  checked: boolean;
  onToggle: () => void;
  points: number;
  onReward: () => void;
  onKick: () => void;
  kicking: boolean;
}) {
  const name = row.displayName ?? row.email ?? "Student";
  const score = 50 + ((name.charCodeAt(0) || 65) % 50);
  return (
    <div
      className={`mb-1 grid grid-cols-[30px_1fr_90px_60px_40px_80px] items-center gap-2 rounded-[9px] border px-2 py-1.5 transition-colors ${
        checked ? "border-acc bg-accbg" : "border-transparent hover:border-bd hover:bg-panel"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="h-3 w-3 accent-blue-600"
      />
      <div className="flex min-w-0 items-center gap-2">
        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-panel2 text-[10px] font-bold text-t2">
          {name.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="truncate text-[12px] font-medium">{name}</p>
          <p className="truncate text-[10px] text-t3">{row.email}</p>
        </div>
      </div>
      <div className="flex justify-center">
        {row.live ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-gbd bg-gbg px-2 py-0.5 text-[9px] font-semibold text-gt">
            <span className="h-1.5 w-1.5 rounded-full bg-green" />
            Online
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full border border-rbd bg-rbg px-2 py-0.5 text-[9px] font-semibold text-rt">
            <span className="h-1.5 w-1.5 rounded-full bg-red" />
            Away
          </span>
        )}
      </div>
      <div className="flex items-center justify-end gap-1.5">
        <div className="h-1 w-8 overflow-hidden rounded bg-bd">
          <div
            className="h-full rounded"
            style={{
              width: `${score}%`,
              background: score >= 70 ? "var(--green)" : score >= 50 ? "var(--amber)" : "var(--red)",
            }}
          />
        </div>
        <span className="min-w-[22px] font-mono text-[10px] font-medium text-t2">{score}</span>
      </div>
      <button
        onClick={onReward}
        className="mx-auto inline-flex items-center gap-1 rounded-full border border-yellow-300 bg-yellow-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 hover:bg-yellow-100"
        title="Give reward"
      >
        <Star className="h-2.5 w-2.5" />
        {points}
      </button>
      <div className="flex items-center justify-center gap-1">
        <button
          className={`flex h-5 w-5 items-center justify-center rounded ${
            row.micOn ? "bg-gbg text-gt" : "bg-rbg text-rt"
          }`}
          title={row.micOn ? "Mic on" : "Mic off"}
        >
          <MicOff className="h-2.5 w-2.5" />
        </button>
        <button
          onClick={onKick}
          disabled={kicking}
          className="flex h-5 w-5 items-center justify-center rounded border border-rbd bg-rbg text-rt hover:bg-red hover:text-white disabled:opacity-50"
          title="Remove from class"
        >
          <UserMinus className="h-2.5 w-2.5" />
        </button>
      </div>
    </div>
  );
}

function StatCard({
  dot,
  num,
  label,
  color,
}: {
  dot: string;
  num: number;
  label: string;
  color?: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-bd bg-surf px-2 py-1.5">
      <div className="h-2 w-2 rounded-full" style={{ background: dot }} />
      <div>
        <p
          className="text-[15px] font-semibold leading-none"
          style={{ color: color ?? "var(--t)" }}
        >
          {num}
        </p>
        <p className="mt-px text-[9px] font-medium uppercase tracking-[.3px] text-t3">
          {label}
        </p>
      </div>
    </div>
  );
}

function LaneDropZone({
  color,
  name,
  count,
  onDrop,
  children,
}: {
  color: string;
  name: string;
  count: number;
  onDrop: () => void;
  children?: React.ReactNode;
}) {
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!over) setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={() => {
        setOver(false);
        onDrop();
      }}
      className={`overflow-hidden rounded-[10px] border transition-colors ${
        over ? "border-acc bg-accbg" : "border-bd bg-panel"
      }`}
    >
      <div className="flex items-center gap-2 border-b border-bd bg-surf px-3 py-2">
        <div className="h-2 w-2 rounded-full" style={{ background: color }} />
        <span className="text-[11px] font-semibold">{name}</span>
        <span className="ml-auto text-[10px] text-t3">{count}</span>
      </div>
      <div className="flex min-h-[54px] flex-wrap gap-1.5 p-2">
        {count === 0 ? (
          <span className="text-[10px] text-t3">Drop here</span>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
