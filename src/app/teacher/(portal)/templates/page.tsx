"use client";
export const dynamic = "force-dynamic";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Send, Pencil } from "lucide-react";
import api from "@/lib/api/client";
import { useClassrooms } from "@/hooks/use-classrooms";

type Item = { title: string; description?: string; durationMin?: number };
type Template = {
  id: string;
  name: string;
  subject?: string;
  items: Item[];
  updatedAt: string;
};

export default function TeacherTemplatesPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Template | null>(null);
  const [creating, setCreating] = useState(false);
  const [applyFor, setApplyFor] = useState<Template | null>(null);

  const templatesQ = useQuery<Template[]>({
    queryKey: ["teacher", "templates"],
    queryFn: () =>
      api.get("/teacher/templates") as unknown as Promise<Template[]>,
  });

  const removeMut = useMutation({
    mutationFn: (id: string) => api.delete(`/teacher/templates/${id}`),
    onSuccess: () => {
      toast.success("Template removed");
      qc.invalidateQueries({ queryKey: ["teacher", "templates"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const items = templatesQ.data ?? [];

  return (
    <div className="min-h-full bg-bg p-6">
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="flex items-center justify-end">
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 rounded-lg bg-acc px-3 py-2 text-xs font-semibold text-white hover:opacity-90"
          >
            <Plus className="h-3.5 w-3.5" />
            New template
          </button>
        </div>

        {templatesQ.isLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-32 animate-pulse rounded-xl bg-panel" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-bd bg-surf py-20 text-center">
            <div
              className="mb-3 flex h-12 w-12 items-center justify-center rounded-full text-[22px]"
              style={{ background: "rgba(245,158,11,.14)" }}
            >
              📝
            </div>
            <h3 className="text-sm font-semibold text-t">No templates yet</h3>
            <p className="mt-1 max-w-sm text-xs text-t3">
              Build a reusable lesson agenda once, then apply it to any classroom
              in seconds.
            </p>
            <button
              onClick={() => setCreating(true)}
              className="mt-4 flex items-center gap-1.5 rounded-lg bg-acc px-4 py-2 text-xs font-semibold text-white hover:opacity-90"
            >
              <Plus className="h-3.5 w-3.5" />
              Create your first template
            </button>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {items.map((t) => {
              const totalMin = t.items.reduce(
                (s, it) => s + (it.durationMin ?? 0),
                0,
              );
              return (
                <div
                  key={t.id}
                  className="flex flex-col rounded-xl border border-bd bg-surf p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-semibold text-t">
                        {t.name}
                      </p>
                      <p className="mt-0.5 text-[11px] text-t3">
                        {t.items.length} step{t.items.length === 1 ? "" : "s"}
                        {totalMin > 0 && ` · ~${totalMin} min`}
                        {t.subject && ` · ${t.subject}`}
                      </p>
                    </div>
                  </div>
                  <ol className="mt-3 space-y-1.5 text-[11.5px] text-t2">
                    {t.items.slice(0, 5).map((it, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="font-mono text-t3">{i + 1}.</span>
                        <span className="line-clamp-1">{it.title}</span>
                        {it.durationMin && (
                          <span className="ml-auto font-mono text-t3">
                            {it.durationMin}m
                          </span>
                        )}
                      </li>
                    ))}
                    {t.items.length > 5 && (
                      <li className="text-t3">+{t.items.length - 5} more</li>
                    )}
                  </ol>
                  <div className="mt-3 flex items-center justify-end gap-2 border-t border-bd pt-2.5">
                    <button
                      onClick={() => setEditing(t)}
                      className="flex items-center gap-1 rounded-md px-2 py-1 text-[10.5px] font-medium text-t2 hover:bg-panel"
                    >
                      <Pencil className="h-3 w-3" />
                      Edit
                    </button>
                    <button
                      onClick={() => setApplyFor(t)}
                      className="flex items-center gap-1 rounded-md px-2 py-1 text-[10.5px] font-semibold text-[#FCD34D] hover:bg-panel"
                    >
                      <Send className="h-3 w-3" />
                      Apply
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Remove "${t.name}"?`)) removeMut.mutate(t.id);
                      }}
                      className="flex items-center gap-1 rounded-md px-2 py-1 text-[10.5px] text-red hover:bg-panel"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {(creating || editing) && (
        <EditorModal
          existing={editing ?? undefined}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
      {applyFor && (
        <ApplyModal template={applyFor} onClose={() => setApplyFor(null)} />
      )}
    </div>
  );
}

function EditorModal({
  existing,
  onClose,
}: {
  existing?: Template;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState(existing?.name ?? "");
  const [subject, setSubject] = useState(existing?.subject ?? "");
  const [items, setItems] = useState<Item[]>(
    existing?.items ?? [{ title: "" }],
  );

  const save = useMutation({
    mutationFn: (data: {
      name: string;
      subject?: string;
      items: Item[];
    }) =>
      existing
        ? api.patch(`/teacher/templates/${existing.id}`, data)
        : api.post("/teacher/templates", data),
    onSuccess: () => {
      toast.success(existing ? "Template updated" : "Template created");
      qc.invalidateQueries({ queryKey: ["teacher", "templates"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-bd bg-surf p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-t">
          {existing ? "Edit template" : "New template"}
        </h2>
        <p className="mt-0.5 text-[11px] text-t3">
          Build the lesson skeleton — title, optional minutes per step.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            const cleanName = name.trim();
            const cleanItems = items
              .map((it) => ({
                title: it.title.trim(),
                description: it.description?.trim() || undefined,
                durationMin: it.durationMin,
              }))
              .filter((it) => it.title.length > 0);
            if (cleanName.length < 1) {
              toast.error("Name required");
              return;
            }
            if (cleanItems.length === 0) {
              toast.error("Add at least one step");
              return;
            }
            save.mutate({
              name: cleanName,
              subject: subject.trim() || undefined,
              items: cleanItems,
            });
          }}
          className="mt-4 space-y-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Name</Label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Intro to Quadratics"
                className="w-full rounded-lg border border-bd bg-panel px-3 py-2 text-[12px] text-t outline-none focus:border-acc"
              />
            </div>
            <div>
              <Label>Subject (optional)</Label>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Math"
                className="w-full rounded-lg border border-bd bg-panel px-3 py-2 text-[12px] text-t outline-none focus:border-acc"
              />
            </div>
          </div>

          <div>
            <Label>Steps</Label>
            <ol className="space-y-2">
              {items.map((it, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-2 font-mono text-[10.5px] text-t3">
                    {i + 1}.
                  </span>
                  <div className="flex-1 space-y-1">
                    <input
                      value={it.title}
                      onChange={(e) =>
                        setItems((prev) =>
                          prev.map((p, j) =>
                            j === i ? { ...p, title: e.target.value } : p,
                          ),
                        )
                      }
                      placeholder="Step title"
                      className="w-full rounded-lg border border-bd bg-panel px-3 py-2 text-[12px] text-t outline-none focus:border-acc"
                    />
                  </div>
                  <input
                    type="number"
                    value={it.durationMin ?? ""}
                    onChange={(e) =>
                      setItems((prev) =>
                        prev.map((p, j) =>
                          j === i
                            ? {
                                ...p,
                                durationMin: e.target.value
                                  ? Number(e.target.value)
                                  : undefined,
                              }
                            : p,
                        ),
                      )
                    }
                    placeholder="min"
                    className="w-16 rounded-lg border border-bd bg-panel px-2 py-2 text-[12px] text-t outline-none focus:border-acc"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setItems((prev) => prev.filter((_, j) => j !== i))
                    }
                    className="mt-1 text-red hover:opacity-80"
                    title="Remove step"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ol>
            <button
              type="button"
              onClick={() =>
                setItems((prev) => [...prev, { title: "" }])
              }
              className="mt-2 flex items-center gap-1 rounded-lg border border-bd px-2.5 py-1.5 text-[11px] font-medium text-t2 hover:bg-panel"
            >
              <Plus className="h-3 w-3" />
              Add step
            </button>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-bd px-3 py-2 text-xs font-medium text-t2 hover:bg-panel"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={save.isPending}
              className="rounded-lg bg-acc px-3 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {save.isPending ? "Saving…" : existing ? "Save changes" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ApplyModal({
  template,
  onClose,
}: {
  template: Template;
  onClose: () => void;
}) {
  const { data: classrooms } = useClassrooms();
  const apply = useMutation({
    mutationFn: ({ classroomId }: { classroomId: string }) =>
      api.post(`/teacher/templates/${template.id}/apply`, { classroomId }),
    onSuccess: (data: { created?: number } | unknown) => {
      const d = data as { created?: number };
      toast.success(
        `Added ${d.created ?? template.items.length} agenda step${
          template.items.length === 1 ? "" : "s"
        }`,
      );
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-bd bg-surf p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-t">
          Apply “{template.name}”
        </h2>
        <p className="mt-0.5 text-[11px] text-t3">
          Adds {template.items.length} step
          {template.items.length === 1 ? "" : "s"} to the selected classroom’s
          agenda.
        </p>
        {!classrooms?.length ? (
          <p className="mt-4 text-[11px] text-t3">No classrooms yet.</p>
        ) : (
          <ul className="mt-4 max-h-72 space-y-1 overflow-y-auto">
            {classrooms.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => apply.mutate({ classroomId: c.id })}
                  disabled={apply.isPending}
                  className="flex w-full items-center justify-between rounded-lg border border-bd bg-panel px-3 py-2.5 text-left text-[12px] text-t hover:bg-panel2"
                >
                  <span className="truncate">{c.name}</span>
                  <Send className="h-3.5 w-3.5 text-[#FCD34D]" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1 block text-[10.5px] font-bold uppercase tracking-wide text-t3">
      {children}
    </label>
  );
}
