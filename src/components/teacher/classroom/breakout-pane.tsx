"use client";

import { useEffect, useMemo, useState } from "react";
import { usePubSub } from "@videosdk.live/react-sdk";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Timer, Megaphone, Plus, X, Trash2, Pencil } from "lucide-react";
import api from "@/lib/api/client";

type Student = { uid: string; displayName?: string; email?: string };

type BreakoutRoom = {
  id: string;
  meetingId: string;
  classroomId: string;
  name: string;
  icon: string;
  members: string[];
  timerEndsAt: string | null;
  closed: boolean;
  createdAt: string;
  updatedAt: string;
};

const ROOM_ICONS = ["🧮", "💬", "🎯", "🧪", "📚", "🎨", "🌍", "⚙️"];
const TIMER_PRESETS_SEC = [60, 5 * 60, 10 * 60, 15 * 60];

function colorFor(uid: string): string {
  const palette = [
    "#7C3AED",
    "#2563EB",
    "#16A34A",
    "#D97706",
    "#DC2626",
    "#0891B2",
    "#DB2777",
    "#0F766E",
  ];
  let h = 0;
  for (let i = 0; i < uid.length; i++) h = (h * 31 + uid.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

function initialsFor(name?: string, fallback = "?"): string {
  if (!name) return fallback;
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatRemaining(endsAt: string | null): string | null {
  if (!endsAt) return null;
  const ms = new Date(endsAt).getTime() - Date.now();
  if (ms <= 0) return "0:00";
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export function BreakoutPane({
  meetingId,
  classroomId,
}: {
  meetingId: string;
  classroomId: string;
}) {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [tick, setTick] = useState(0);

  // Re-render every second so the timer countdown updates without
  // triggering refetches.
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const { publish: publishUpdate } = usePubSub("BREAKOUT_UPDATE");
  const { publish: publishRecall } = usePubSub("BREAKOUT_RECALL");
  const { publish: publishBroadcast } = usePubSub("BREAKOUT_BROADCAST");

  const studentsQ = useQuery({
    queryKey: ["classroom-students", classroomId],
    queryFn: () =>
      api.get(`/classrooms/${classroomId}/students`) as unknown as Promise<Student[]>,
    enabled: !!classroomId,
  });

  const roomsQ = useQuery({
    queryKey: ["breakout-rooms", meetingId],
    queryFn: () =>
      api.get(`/meetings/${meetingId}/breakouts`) as unknown as Promise<BreakoutRoom[]>,
    enabled: !!meetingId,
    refetchInterval: 12_000,
  });

  const rooms = roomsQ.data ?? [];
  const assignedIds = useMemo(() => new Set(rooms.flatMap((r) => r.members)), [rooms]);
  const totalAssigned = assignedIds.size;

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["breakout-rooms", meetingId] });

  const recallMut = useMutation({
    mutationFn: () => api.post(`/meetings/${meetingId}/breakouts/recall`, {}),
    onSuccess: () => {
      publishRecall(JSON.stringify({ meetingId, at: Date.now() }), { persist: false });
      publishUpdate(String(Date.now()), { persist: true });
      toast.success("All students recalled");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message ?? "Recall failed"),
  });

  return (
    <div className="flex-1 overflow-y-auto bg-surf p-3.5">
      <div className="mb-2.5 flex items-center justify-between">
        <div>
          <p className="text-[13px] font-semibold">Breakout Rooms</p>
          <p className="mt-px text-[11px] text-t3">
            {rooms.length} {rooms.length === 1 ? "room" : "rooms"} · {totalAssigned}{" "}
            assigned
          </p>
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={() => setBroadcastOpen(true)}
            disabled={rooms.length === 0}
            className="flex items-center gap-1 rounded-md border border-bd2 bg-surf px-2.5 py-1 text-[10px] font-medium text-t2 hover:bg-panel disabled:opacity-50"
          >
            <Megaphone className="h-3 w-3" /> Broadcast
          </button>
          <button
            onClick={() => recallMut.mutate()}
            disabled={recallMut.isPending || rooms.length === 0}
            className="rounded-md bg-acc px-2.5 py-1 text-[10px] font-medium text-white disabled:opacity-50"
          >
            {recallMut.isPending ? "Recalling…" : "Recall all"}
          </button>
        </div>
      </div>

      {rooms.length === 0 && !roomsQ.isLoading && (
        <div className="mb-2 rounded-[10px] border border-dashed border-bd2 bg-panel/40 px-3 py-6 text-center">
          <p className="text-[12px] font-medium text-t2">No breakout rooms yet</p>
          <p className="mt-1 text-[10.5px] text-t3">
            Create a room and assign students to split the class.
          </p>
        </div>
      )}

      {rooms.map((r) => (
        <RoomCard
          key={r.id}
          room={r}
          students={studentsQ.data ?? []}
          meetingId={meetingId}
          tick={tick}
          onChanged={invalidate}
          onSignal={() => publishUpdate(String(Date.now()), { persist: true })}
        />
      ))}

      <button
        onClick={() => setCreateOpen(true)}
        className="mt-1.5 w-full rounded-[10px] border-[1.5px] border-dashed border-bd2 bg-transparent px-3 py-3 text-center transition-colors hover:border-acc hover:bg-accbg"
      >
        <Plus className="mx-auto h-4 w-4 text-t3" />
        <p className="mt-1 text-[12px] font-medium text-t2">Add a room</p>
        <p className="text-[10px] text-t3">Pick students after creating</p>
      </button>

      {createOpen && (
        <CreateRoomDialog
          meetingId={meetingId}
          students={studentsQ.data ?? []}
          assignedIds={assignedIds}
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            invalidate();
            publishUpdate(String(Date.now()), { persist: true });
          }}
        />
      )}

      {broadcastOpen && (
        <BroadcastDialog
          onClose={() => setBroadcastOpen(false)}
          onSend={(message) => {
            publishBroadcast(
              JSON.stringify({ meetingId, message, at: Date.now() }),
              { persist: false },
            );
            toast.success("Broadcast sent to all rooms");
            setBroadcastOpen(false);
          }}
        />
      )}
    </div>
  );
}

/* ─────────── Room card ─────────── */

function RoomCard({
  room,
  students,
  meetingId,
  tick: _tick,
  onChanged,
  onSignal,
}: {
  room: BreakoutRoom;
  students: Student[];
  meetingId: string;
  tick: number;
  onChanged: () => void;
  onSignal: () => void;
}) {
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(room.name);
  const [pickerOpen, setPickerOpen] = useState(false);

  const memberStudents = useMemo(
    () =>
      room.members
        .map((uid) => students.find((s) => s.uid === uid))
        .filter((s): s is Student => Boolean(s)),
    [room.members, students],
  );

  const remaining = formatRemaining(room.timerEndsAt);
  const expired =
    room.timerEndsAt && new Date(room.timerEndsAt).getTime() <= Date.now();

  const patchMut = useMutation({
    mutationFn: (patch: Record<string, unknown>) =>
      api.patch(`/meetings/${meetingId}/breakouts/${room.id}`, patch),
    onSuccess: () => {
      onChanged();
      onSignal();
    },
    onError: (e: Error) => toast.error(e.message ?? "Update failed"),
  });

  const deleteMut = useMutation({
    mutationFn: () => api.delete(`/meetings/${meetingId}/breakouts/${room.id}`),
    onSuccess: () => {
      onChanged();
      onSignal();
      toast.success("Room deleted");
    },
    onError: (e: Error) => toast.error(e.message ?? "Delete failed"),
  });

  const setTimer = (seconds: number | null) => {
    patchMut.mutate({ timerSec: seconds });
  };

  const removeMember = (uid: string) => {
    const next = room.members.filter((m) => m !== uid);
    patchMut.mutate({ members: next });
  };

  const saveName = () => {
    setEditingName(false);
    if (name.trim() && name !== room.name) patchMut.mutate({ name: name.trim() });
  };

  return (
    <div className="mb-2 overflow-hidden rounded-[11px] border border-bd bg-surf">
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <div
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-panel text-sm"
        >
          {room.icon}
        </div>
        <div className="min-w-0 flex-1">
          {editingName ? (
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={saveName}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveName();
                if (e.key === "Escape") {
                  setName(room.name);
                  setEditingName(false);
                }
              }}
              className="w-full rounded border border-bd bg-surf px-2 py-1 text-[12px] font-semibold text-t outline-none focus:border-acc"
            />
          ) : (
            <button
              onClick={() => setEditingName(true)}
              className="flex w-full items-center gap-1 text-left text-[12px] font-semibold text-t hover:text-acc"
              title="Rename"
            >
              <span className="truncate">{room.name}</span>
              <Pencil className="h-3 w-3 flex-shrink-0 opacity-50" />
            </button>
          )}
          <p className="mt-px truncate text-[10px] text-t3">
            {room.members.length} student{room.members.length === 1 ? "" : "s"}
            {remaining && (
              <>
                {" "}
                ·{" "}
                <span style={{ color: expired ? "var(--red)" : "var(--blue)" }}>
                  ⏱ {expired ? "expired" : remaining}
                </span>
              </>
            )}
            {room.closed && <span className="ml-1 text-t3">· closed</span>}
          </p>
        </div>
        <button
          onClick={() => deleteMut.mutate()}
          disabled={deleteMut.isPending}
          className="flex-shrink-0 rounded-md border border-bd2 bg-surf p-1.5 text-t3 hover:border-red hover:text-red disabled:opacity-50"
          title="Delete room"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>

      <div className="px-3 pb-2.5">
        {memberStudents.length === 0 ? (
          <p className="mb-2 rounded-[8px] border border-dashed border-bd2 px-2 py-2 text-center text-[10px] text-t3">
            No students yet — assign some below
          </p>
        ) : (
          <div className="mb-2 flex flex-wrap gap-1">
            {memberStudents.map((m) => (
              <span
                key={m.uid}
                className="flex items-center gap-1 rounded-full bg-panel px-1 py-0.5 pr-1.5 text-[9.5px] font-medium text-t2"
              >
                <span
                  className="flex h-[18px] w-[18px] items-center justify-center rounded-full text-[8px] font-bold text-white"
                  style={{ background: colorFor(m.uid) }}
                >
                  {initialsFor(m.displayName ?? m.email)}
                </span>
                <span className="max-w-[80px] truncate">
                  {m.displayName ?? m.email ?? m.uid.slice(0, 6)}
                </span>
                <button
                  onClick={() => removeMember(m.uid)}
                  className="rounded-full p-0.5 text-t3 hover:bg-bd hover:text-red"
                  title="Remove"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setPickerOpen(true)}
            className="flex items-center gap-1 rounded-md border border-bd2 bg-surf px-2 py-1 text-[10px] font-medium text-t2 hover:border-acc hover:bg-accbg"
          >
            <Plus className="h-3 w-3" /> Assign
          </button>
          <div className="flex items-center gap-1 rounded-md border border-bd2 bg-surf px-1.5 py-0.5">
            <Timer className="h-3 w-3 text-t3" />
            {TIMER_PRESETS_SEC.map((s) => (
              <button
                key={s}
                onClick={() => setTimer(s)}
                disabled={patchMut.isPending}
                className="rounded px-1 text-[9.5px] font-medium text-t2 hover:text-acc disabled:opacity-50"
                title={`${s / 60}-minute timer`}
              >
                {s / 60}m
              </button>
            ))}
            {room.timerEndsAt && (
              <button
                onClick={() => setTimer(null)}
                className="rounded px-1 text-[9.5px] font-medium text-red hover:bg-red hover:text-white"
                title="Clear timer"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {pickerOpen && (
        <AssignPicker
          students={students}
          currentMembers={room.members}
          onClose={() => setPickerOpen(false)}
          onSave={(members) => {
            patchMut.mutate({ members });
            setPickerOpen(false);
          }}
        />
      )}
    </div>
  );
}

/* ─────────── Create-room dialog ─────────── */

function CreateRoomDialog({
  meetingId,
  students,
  assignedIds,
  onClose,
  onCreated,
}: {
  meetingId: string;
  students: Student[];
  assignedIds: Set<string>;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState(ROOM_ICONS[0]);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const createMut = useMutation({
    mutationFn: () =>
      api.post(`/meetings/${meetingId}/breakouts`, {
        name: name.trim() || "Breakout room",
        icon,
        members: Array.from(picked),
      }),
    onSuccess: () => {
      toast.success("Room created");
      onCreated();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message ?? "Create failed"),
  });

  return (
    <DialogShell title="New breakout room" onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-[10.5px] font-medium text-t2">
            Room name
          </label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Practice problems"
            className="w-full rounded-md border border-bd bg-surf px-2.5 py-1.5 text-[12px] text-t outline-none focus:border-acc"
          />
        </div>
        <div>
          <label className="mb-1 block text-[10.5px] font-medium text-t2">Icon</label>
          <div className="flex flex-wrap gap-1">
            {ROOM_ICONS.map((i) => (
              <button
                key={i}
                onClick={() => setIcon(i)}
                className={`flex h-7 w-7 items-center justify-center rounded-md border text-sm ${
                  icon === i ? "border-acc bg-accbg" : "border-bd bg-surf hover:bg-panel"
                }`}
              >
                {i}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="mb-1 block text-[10.5px] font-medium text-t2">
            Assign students ({picked.size})
          </label>
          <StudentPickerList
            students={students}
            picked={picked}
            disabledIds={assignedIds}
            onToggle={(uid) => {
              const n = new Set(picked);
              if (n.has(uid)) n.delete(uid);
              else n.add(uid);
              setPicked(n);
            }}
          />
        </div>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <button
          onClick={onClose}
          className="rounded-md border border-bd px-3 py-1.5 text-[11px] font-medium text-t2 hover:bg-panel"
        >
          Cancel
        </button>
        <button
          onClick={() => createMut.mutate()}
          disabled={createMut.isPending || !name.trim()}
          className="rounded-md bg-acc px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50"
        >
          {createMut.isPending ? "Creating…" : "Create"}
        </button>
      </div>
    </DialogShell>
  );
}

/* ─────────── Assign picker ─────────── */

function AssignPicker({
  students,
  currentMembers,
  onClose,
  onSave,
}: {
  students: Student[];
  currentMembers: string[];
  onClose: () => void;
  onSave: (members: string[]) => void;
}) {
  const [picked, setPicked] = useState<Set<string>>(new Set(currentMembers));
  return (
    <DialogShell title="Assign students" onClose={onClose}>
      <StudentPickerList
        students={students}
        picked={picked}
        onToggle={(uid) => {
          const n = new Set(picked);
          if (n.has(uid)) n.delete(uid);
          else n.add(uid);
          setPicked(n);
        }}
      />
      <div className="mt-3 flex justify-end gap-2">
        <button
          onClick={onClose}
          className="rounded-md border border-bd px-3 py-1.5 text-[11px] font-medium text-t2 hover:bg-panel"
        >
          Cancel
        </button>
        <button
          onClick={() => onSave(Array.from(picked))}
          className="rounded-md bg-acc px-3 py-1.5 text-[11px] font-semibold text-white"
        >
          Save ({picked.size})
        </button>
      </div>
    </DialogShell>
  );
}

function StudentPickerList({
  students,
  picked,
  disabledIds,
  onToggle,
}: {
  students: Student[];
  picked: Set<string>;
  disabledIds?: Set<string>;
  onToggle: (uid: string) => void;
}) {
  if (students.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-bd2 px-3 py-4 text-center text-[11px] text-t3">
        No students enrolled yet.
      </p>
    );
  }
  return (
    <div className="max-h-[220px] overflow-y-auto rounded-md border border-bd">
      {students.map((s) => {
        const id = s.uid;
        const checked = picked.has(id);
        const disabled = !checked && disabledIds?.has(id);
        return (
          <label
            key={id}
            className={`flex cursor-pointer items-center gap-2 border-b border-bd px-2.5 py-1.5 text-[11px] last:border-b-0 ${
              disabled ? "cursor-not-allowed opacity-40" : "hover:bg-panel"
            }`}
            title={disabled ? "Already in another room" : undefined}
          >
            <input
              type="checkbox"
              checked={checked}
              disabled={disabled}
              onChange={() => onToggle(id)}
              className="h-3.5 w-3.5"
            />
            <span
              className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[8px] font-bold text-white"
              style={{ background: colorFor(id) }}
            >
              {initialsFor(s.displayName ?? s.email)}
            </span>
            <span className="truncate text-t">
              {s.displayName ?? s.email ?? id.slice(0, 8)}
            </span>
          </label>
        );
      })}
    </div>
  );
}

/* ─────────── Broadcast dialog ─────────── */

function BroadcastDialog({
  onClose,
  onSend,
}: {
  onClose: () => void;
  onSend: (message: string) => void;
}) {
  const [msg, setMsg] = useState("");
  return (
    <DialogShell title="Broadcast to all rooms" onClose={onClose}>
      <textarea
        autoFocus
        value={msg}
        onChange={(e) => setMsg(e.target.value)}
        rows={3}
        placeholder="e.g. Wrap up your discussion in 2 minutes…"
        className="w-full rounded-md border border-bd bg-surf px-2.5 py-1.5 text-[12px] text-t outline-none focus:border-acc"
      />
      <div className="mt-3 flex justify-end gap-2">
        <button
          onClick={onClose}
          className="rounded-md border border-bd px-3 py-1.5 text-[11px] font-medium text-t2 hover:bg-panel"
        >
          Cancel
        </button>
        <button
          onClick={() => onSend(msg.trim())}
          disabled={!msg.trim()}
          className="rounded-md bg-acc px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </DialogShell>
  );
}

/* ─────────── Tiny dialog shell (avoids the heavier shared Modal) ─────────── */

function DialogShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[420px] rounded-[12px] border border-bd bg-surf p-4 shadow-xl"
      >
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[13px] font-semibold text-t">{title}</p>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-t3 hover:bg-panel hover:text-t"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
