"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BarChart3,
  Plus,
  Trash2,
  Loader2,
  Calculator,
  Check,
  ExternalLink,
  Link as LinkIcon,
} from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api/client";
import type { ClassNote } from "@/server/services/class-notes.service";
import type { AgendaItem } from "@/server/services/agenda.service";
import type { ResourceItem } from "@/server/services/resources.service";

type Tab = "agenda" | "notes" | "resources";

export function LeftPanel({
  classroomId,
  onShowComprehension,
  onOpenCalculator,
}: {
  classroomId: string;
  onShowComprehension?: () => void;
  onOpenCalculator?: () => void;
}) {
  const [tab, setTab] = useState<Tab>("agenda");

  return (
    <aside
      className="flex w-[272px] flex-shrink-0 flex-col overflow-hidden border-r bg-surf"
      style={{ borderColor: "var(--bd)" }}
    >
      {/* Tabs */}
      <div className="flex flex-shrink-0 border-b border-bd bg-surf">
        {(["agenda", "notes", "resources"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`-mb-px flex-1 border-b-2 py-[9px] text-center text-[10px] font-semibold tracking-[.1px] transition-colors ${
              tab === t
                ? "border-acc text-acc"
                : "border-transparent text-t3 hover:text-t2"
            }`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Class Comprehension button */}
      <button
        onClick={onShowComprehension}
        className="mx-[14px] mb-1 mt-2 flex flex-shrink-0 items-center gap-1.5 rounded-[9px] border-[1.5px] border-[#D1D5DB] bg-white px-3 py-2 text-[11px] font-semibold text-[#4B5563] hover:bg-panel"
      >
        <BarChart3 className="h-3.5 w-3.5" />
        Class Comprehension
      </button>

      {tab === "agenda" && <AgendaTab classroomId={classroomId} canEdit />}
      {tab === "notes" && <NotesTab classroomId={classroomId} />}
      {tab === "resources" && (
        <ResourcesTab
          classroomId={classroomId}
          canEdit
          onOpenCalculator={onOpenCalculator}
        />
      )}
    </aside>
  );
}

/* ─── Agenda (Firestore-backed) ─── */

export function AgendaTab({
  classroomId,
  canEdit,
}: {
  classroomId: string;
  canEdit: boolean;
}) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");

  const { data: items = [], isLoading } = useQuery<AgendaItem[]>({
    queryKey: ["agenda", classroomId],
    queryFn: () =>
      api.get(`/classrooms/${classroomId}/agenda`) as unknown as Promise<AgendaItem[]>,
    enabled: !!classroomId,
    refetchInterval: canEdit ? false : 20_000,
  });

  const addMut = useMutation({
    mutationFn: (t: string) =>
      api.post(`/classrooms/${classroomId}/agenda`, { title: t }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agenda", classroomId] });
      setTitle("");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleMut = useMutation({
    mutationFn: ({ itemId, done }: { itemId: string; done: boolean }) =>
      api.patch(`/classrooms/${classroomId}/agenda/${itemId}`, { done }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agenda", classroomId] }),
  });

  const deleteMut = useMutation({
    mutationFn: (itemId: string) =>
      api.delete(`/classrooms/${classroomId}/agenda/${itemId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agenda", classroomId] }),
  });

  const save = () => {
    const t = title.trim();
    if (!t || addMut.isPending) return;
    addMut.mutate(t);
  };

  const doneCount = items.filter((i) => i.done).length;
  const pct = items.length ? Math.round((doneCount / items.length) * 100) : 0;

  return (
    <div className="flex-1 overflow-y-auto p-[14px]">
      {items.length > 0 && (
        <div className="mb-3">
          <div className="mb-1 flex items-center justify-between text-[10px] text-t3">
            <span>Progress</span>
            <span>
              {doneCount} / {items.length} · {pct}%
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-panel2">
            <div
              className="h-full rounded-full bg-acc transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {canEdit && (
        <div className="mb-2.5 flex gap-1.5">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), save())}
            placeholder="Add agenda item…"
            disabled={addMut.isPending}
            className="flex-1 rounded-lg border border-bd bg-surf px-[9px] py-1.5 text-[11px] text-t outline-none focus:border-acc disabled:opacity-50"
          />
          <button
            onClick={save}
            disabled={addMut.isPending || !title.trim()}
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-[7px] bg-acc text-white disabled:opacity-40"
            aria-label="Add agenda item"
          >
            {addMut.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
          </button>
        </div>
      )}

      {isLoading ? (
        <p className="py-6 text-center text-[11px] text-t3">Loading agenda…</p>
      ) : items.length === 0 ? (
        <p className="py-6 text-center text-[11px] leading-[1.6] text-t3">
          {canEdit
            ? "No agenda yet. Add your first item above."
            : "Your teacher hasn't set an agenda for this class."}
        </p>
      ) : (
        <ul className="space-y-1">
          {items.map((item) => (
            <AgendaRow
              key={item.id}
              item={item}
              canEdit={canEdit}
              onToggle={() =>
                toggleMut.mutate({ itemId: item.id, done: !item.done })
              }
              onDelete={() => deleteMut.mutate(item.id)}
              deleting={deleteMut.isPending && deleteMut.variables === item.id}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function AgendaRow({
  item,
  canEdit,
  onToggle,
  onDelete,
  deleting,
}: {
  item: AgendaItem;
  canEdit: boolean;
  onToggle: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  return (
    <li
      className={`group flex items-center gap-2 rounded-[7px] border border-bd px-2 py-1.5 transition-colors ${
        item.done ? "bg-panel/60 opacity-70" : "bg-surf"
      }`}
    >
      <button
        onClick={canEdit ? onToggle : undefined}
        disabled={!canEdit}
        className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border-[1.5px] ${
          item.done ? "border-acc bg-acc text-white" : "border-bd2 bg-surf"
        }`}
        aria-label={item.done ? "Mark incomplete" : "Mark done"}
      >
        {item.done && <Check className="h-2.5 w-2.5" />}
      </button>
      <p
        className={`flex-1 text-[11px] ${
          item.done ? "text-t3 line-through" : "text-t"
        }`}
      >
        {item.title}
      </p>
      {canEdit && (
        <button
          onClick={onDelete}
          disabled={deleting}
          className="rounded p-0.5 text-t3 opacity-0 transition-opacity hover:bg-rbg hover:text-rt group-hover:opacity-100 disabled:opacity-50"
          aria-label="Delete agenda item"
        >
          {deleting ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Trash2 className="h-3 w-3" />
          )}
        </button>
      )}
    </li>
  );
}

/* ─── Notes (Firestore-backed) ─── */

function NotesTab({ classroomId }: { classroomId: string }) {
  const qc = useQueryClient();
  const [text, setText] = useState("");

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ["class-notes", classroomId],
    queryFn: () =>
      api.get(`/classrooms/${classroomId}/notes`) as unknown as Promise<ClassNote[]>,
    enabled: !!classroomId,
  });

  const addMut = useMutation({
    mutationFn: (t: string) =>
      api.post(`/classrooms/${classroomId}/notes`, { text: t }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["class-notes", classroomId] });
      setText("");
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/classrooms/${classroomId}/notes/${id}`),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["class-notes", classroomId] }),
  });

  const save = () => {
    const t = text.trim();
    if (!t || addMut.isPending) return;
    addMut.mutate(t);
  };

  return (
    <div className="flex-1 overflow-y-auto p-[14px]">
      <div className="mb-2.5 flex gap-1.5">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), save())}
          placeholder="Quick note…"
          disabled={addMut.isPending}
          className="flex-1 rounded-lg border border-bd bg-surf px-[9px] py-1.5 text-[11px] text-t outline-none focus:border-acc disabled:opacity-50"
        />
        <button
          onClick={save}
          disabled={addMut.isPending || !text.trim()}
          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-[7px] bg-acc text-white disabled:opacity-40"
          aria-label="Add note"
        >
          {addMut.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
        </button>
      </div>

      {isLoading ? (
        <p className="py-6 text-center text-[11px] text-t3">Loading notes…</p>
      ) : notes.length === 0 ? (
        <p className="py-6 text-center text-[11px] leading-[1.6] text-t3">
          No notes yet. Add one above, or an admin can import class notes from the admin
          panel.
        </p>
      ) : (
        <div className="space-y-1.5">
          {notes.map((n) => (
            <NoteCard
              key={n.id}
              note={n}
              onDelete={() => deleteMut.mutate(n.id)}
              deleting={deleteMut.isPending && deleteMut.variables === n.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function NoteCard({
  note,
  onDelete,
  deleting,
}: {
  note: ClassNote;
  onDelete: () => void;
  deleting: boolean;
}) {
  const time = new Date(note.createdAt);
  const label =
    time.toDateString() === new Date().toDateString()
      ? `${time.getHours()}:${String(time.getMinutes()).padStart(2, "0")}`
      : time.toLocaleDateString();
  return (
    <div className="group rounded-[9px] border border-bd bg-surf px-[11px] py-[9px]">
      <div className="mb-1 flex items-center justify-between">
        <span
          className="rounded px-1.5 py-[2px] text-[9px] font-semibold"
          style={{
            background: note.authorRole === "admin" ? "var(--pbg)" : "var(--bbg)",
            color: note.authorRole === "admin" ? "var(--pt)" : "var(--bt)",
          }}
        >
          {note.authorRole === "admin" ? "Admin" : note.authorName || "Teacher"}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-t3">{label}</span>
          <button
            onClick={onDelete}
            disabled={deleting}
            className="rounded p-0.5 text-t3 opacity-0 transition-opacity hover:bg-rbg hover:text-rt group-hover:opacity-100 disabled:opacity-50"
            aria-label="Delete note"
          >
            {deleting ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Trash2 className="h-3 w-3" />
            )}
          </button>
        </div>
      </div>
      <p className="whitespace-pre-wrap text-[11px] leading-[1.55] text-t2">
        {note.text}
      </p>
    </div>
  );
}

/* ─── Resources (Firestore-backed) ─── */

export function ResourcesTab({
  classroomId,
  canEdit,
  onOpenCalculator,
}: {
  classroomId: string;
  canEdit: boolean;
  onOpenCalculator?: () => void;
}) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");

  const { data: items = [], isLoading } = useQuery<ResourceItem[]>({
    queryKey: ["resources", classroomId],
    queryFn: () =>
      api.get(`/classrooms/${classroomId}/resources`) as unknown as Promise<ResourceItem[]>,
    enabled: !!classroomId,
    refetchInterval: canEdit ? false : 20_000,
  });

  const addMut = useMutation({
    mutationFn: () =>
      api.post(`/classrooms/${classroomId}/resources`, {
        kind: "link",
        title: title.trim(),
        url: url.trim(),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["resources", classroomId] });
      setTitle("");
      setUrl("");
      setAdding(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const delMut = useMutation({
    mutationFn: (itemId: string) =>
      api.delete(`/classrooms/${classroomId}/resources/${itemId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["resources", classroomId] }),
  });

  return (
    <div className="flex-1 overflow-y-auto p-[14px]">
      {onOpenCalculator && (
        <>
          <ResLabel>Tools</ResLabel>
          <ResCard
            icon={<Calculator className="h-4 w-4" style={{ color: "var(--pt)" }} />}
            iconBg="var(--pbg)"
            title="Scientific calculator"
            sub="Shared live with the class"
            btn="Open"
            onClick={onOpenCalculator}
          />
        </>
      )}

      <ResLabel>Links &amp; documents</ResLabel>

      {canEdit && !adding && (
        <button
          onClick={() => setAdding(true)}
          className="mb-2 flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-bd px-2 py-1.5 text-[10px] font-semibold text-t3 hover:border-acc hover:text-acc"
        >
          <Plus className="h-3 w-3" />
          Add link
        </button>
      )}
      {canEdit && adding && (
        <div className="mb-2 rounded-lg border border-bd bg-panel p-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            className="mb-1.5 w-full rounded-md border border-bd bg-surf px-2 py-1 text-[10px] outline-none focus:border-acc"
          />
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
            className="mb-1.5 w-full rounded-md border border-bd bg-surf px-2 py-1 text-[10px] outline-none focus:border-acc"
          />
          <div className="flex justify-end gap-1">
            <button
              onClick={() => {
                setAdding(false);
                setTitle("");
                setUrl("");
              }}
              className="rounded-md border border-bd px-2 py-0.5 text-[10px] text-t2 hover:bg-surf"
            >
              Cancel
            </button>
            <button
              onClick={() => addMut.mutate()}
              disabled={addMut.isPending || !title.trim() || !url.trim()}
              className="rounded-md bg-acc px-2 py-0.5 text-[10px] font-semibold text-white disabled:opacity-50"
            >
              {addMut.isPending ? "Adding…" : "Add"}
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="py-4 text-center text-[10px] text-t3">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-[10px] leading-[1.5] text-t3">
          {canEdit
            ? "No resources yet. Add links students should be able to reference."
            : "Your teacher hasn't shared any resources for this class yet."}
        </p>
      ) : (
        <ul className="space-y-1">
          {items.map((r) => (
            <li
              key={r.id}
              className="group flex items-center gap-2 rounded-lg border border-bd bg-surf px-2 py-1.5"
            >
              <LinkIcon className="h-3 w-3 flex-shrink-0 text-t3" />
              <a
                href={r.url}
                target="_blank"
                rel="noreferrer noopener"
                className="min-w-0 flex-1 truncate text-[11px] font-medium text-t hover:text-acc"
                title={r.url}
              >
                {r.title}
              </a>
              <a
                href={r.url}
                target="_blank"
                rel="noreferrer noopener"
                className="opacity-60 hover:opacity-100"
                aria-label="Open link"
              >
                <ExternalLink className="h-3 w-3 text-t3" />
              </a>
              {canEdit && (
                <button
                  onClick={() => delMut.mutate(r.id)}
                  disabled={delMut.isPending && delMut.variables === r.id}
                  className="rounded p-0.5 text-t3 opacity-0 transition-opacity hover:bg-rbg hover:text-rt group-hover:opacity-100 disabled:opacity-50"
                  aria-label="Delete resource"
                >
                  {delMut.isPending && delMut.variables === r.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Trash2 className="h-3 w-3" />
                  )}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ResLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1.5 mt-2.5 text-[9px] font-semibold uppercase tracking-[.7px] text-t3 first:mt-0">
      {children}
    </p>
  );
}

function ResCard({
  icon,
  iconBg,
  title,
  sub,
  btn,
  onClick,
}: {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  sub: string;
  btn: string;
  onClick?: () => void;
}) {
  return (
    <div className="mb-1.5 rounded-[9px] border border-bd bg-surf px-[11px] py-[9px]">
      <div className="mb-[7px] flex gap-[9px]">
        <div
          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md"
          style={{ background: iconBg }}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-t">{title}</p>
          <p className="text-[10px] text-t3">{sub}</p>
        </div>
      </div>
      <button
        onClick={onClick}
        className="w-full rounded-md border border-bd2 bg-transparent px-2 py-1 text-[10px] font-medium text-t2 transition-colors hover:bg-panel"
      >
        {btn}
      </button>
    </div>
  );
}
