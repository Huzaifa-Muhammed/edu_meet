"use client";
export const dynamic = "force-dynamic";

import { useState, useMemo } from "react";
import Image from "next/image";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Link as LinkIcon, ExternalLink, Send } from "lucide-react";
import api from "@/lib/api/client";
import { useClassrooms } from "@/hooks/use-classrooms";

type Resource = {
  id: string;
  kind: "link" | "image";
  title: string;
  url: string;
  description?: string;
  publicId?: string;
  tags: string[];
  createdAt: string;
};

export default function TeacherLibraryPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | "link" | "image">("all");
  const [q, setQ] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [pushFor, setPushFor] = useState<Resource | null>(null);

  const itemsQ = useQuery<Resource[]>({
    queryKey: ["teacher", "resources"],
    queryFn: () =>
      api.get("/teacher/resources") as unknown as Promise<Resource[]>,
  });

  const removeMut = useMutation({
    mutationFn: (id: string) => api.delete(`/teacher/resources/${id}`),
    onSuccess: () => {
      toast.success("Removed from library");
      qc.invalidateQueries({ queryKey: ["teacher", "resources"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const items = itemsQ.data ?? [];
  const filtered = useMemo(() => {
    return items.filter((it) => {
      if (filter !== "all" && it.kind !== filter) return false;
      if (q.trim()) {
        const needle = q.toLowerCase();
        return (
          it.title.toLowerCase().includes(needle) ||
          (it.description ?? "").toLowerCase().includes(needle) ||
          it.tags.some((t) => t.toLowerCase().includes(needle))
        );
      }
      return true;
    });
  }, [items, filter, q]);

  return (
    <div className="min-h-full bg-bg p-6">
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search title, description or tag…"
            className="flex-1 rounded-lg border border-bd bg-surf px-3 py-2 text-xs text-t outline-none placeholder:text-t3"
          />
          <div className="flex gap-1 rounded-lg bg-panel p-1">
            {(["all", "link", "image"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-md px-3 py-1 text-[11px] font-medium capitalize ${
                  filter === f ? "bg-surf text-t shadow-sm" : "text-t3"
                }`}
              >
                {f === "image" ? "Images" : f === "link" ? "Links" : "All"}
              </button>
            ))}
          </div>
          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-acc px-3 py-2 text-xs font-semibold text-white hover:opacity-90"
          >
            <Plus className="h-3.5 w-3.5" />
            Add resource
          </button>
        </div>

        {itemsQ.isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-32 animate-pulse rounded-xl bg-panel" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-bd bg-surf py-20 text-center">
            <div
              className="mb-3 flex h-12 w-12 items-center justify-center rounded-full text-[22px]"
              style={{ background: "rgba(245,158,11,.14)" }}
            >
              📁
            </div>
            <h3 className="text-sm font-semibold text-t">No resources yet</h3>
            <p className="mt-1 max-w-sm text-xs text-t3">
              Add reusable links, slides or worksheets here. Then push any of them
              into a live classroom in one click.
            </p>
            <button
              onClick={() => setAddOpen(true)}
              className="mt-4 flex items-center gap-1.5 rounded-lg bg-acc px-4 py-2 text-xs font-semibold text-white hover:opacity-90"
            >
              <Plus className="h-3.5 w-3.5" />
              Add your first resource
            </button>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((it) => (
              <div
                key={it.id}
                className="flex flex-col overflow-hidden rounded-xl border border-bd bg-surf"
              >
                {it.kind === "image" ? (
                  <div className="relative h-32 w-full overflow-hidden bg-panel2">
                    <Image
                      src={it.url}
                      alt={it.title}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                ) : (
                  <div
                    className="flex h-32 items-center justify-center"
                    style={{
                      background:
                        "linear-gradient(135deg,rgba(245,158,11,.18),rgba(217,119,6,.10))",
                    }}
                  >
                    <LinkIcon className="h-8 w-8 text-[#FCD34D]" />
                  </div>
                )}
                <div className="flex flex-1 flex-col p-3">
                  <p className="line-clamp-1 text-[13px] font-semibold text-t">
                    {it.title}
                  </p>
                  {it.description && (
                    <p className="mt-0.5 line-clamp-2 text-[11px] text-t3">
                      {it.description}
                    </p>
                  )}
                  {it.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {it.tags.map((t) => (
                        <span
                          key={t}
                          className="rounded-full px-2 py-px text-[9px] font-semibold"
                          style={{
                            background: "rgba(245,158,11,.14)",
                            color: "#FCD34D",
                          }}
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="mt-3 flex items-center justify-between border-t border-bd pt-2.5">
                    <a
                      href={it.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[10.5px] font-medium text-bt hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Open
                    </a>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setPushFor(it)}
                        className="flex items-center gap-1 rounded-md px-2 py-0.5 text-[10.5px] font-semibold text-[#FCD34D] hover:bg-panel"
                        title="Push to a classroom"
                      >
                        <Send className="h-3 w-3" />
                        Push
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Remove "${it.title}"?`))
                            removeMut.mutate(it.id);
                        }}
                        className="flex items-center gap-1 rounded-md px-2 py-0.5 text-[10.5px] text-red hover:bg-panel"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AddModal open={addOpen} onClose={() => setAddOpen(false)} />
      <PushModal
        resource={pushFor}
        onClose={() => setPushFor(null)}
      />
    </div>
  );
}

function AddModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [kind, setKind] = useState<"link" | "image">("link");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [uploading, setUploading] = useState(false);
  const [publicId, setPublicId] = useState<string | undefined>();

  const create = useMutation({
    mutationFn: (data: {
      kind: "link" | "image";
      title: string;
      url: string;
      description?: string;
      publicId?: string;
      tags: string[];
    }) => api.post("/teacher/resources", data),
    onSuccess: () => {
      toast.success("Added to library");
      qc.invalidateQueries({ queryKey: ["teacher", "resources"] });
      setTitle("");
      setUrl("");
      setDescription("");
      setTags("");
      setPublicId(undefined);
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function handleFile(file: File) {
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Image must be under 8 MB");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { getFirebaseAuth } = await import("@/lib/firebase/client");
      const token = await getFirebaseAuth().currentUser?.getIdToken();
      const res = await fetch("/api/uploads/teacher-credentials", {
        method: "POST",
        body: fd,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const data = (await res.json()) as {
        data?: { url: string; publicId: string };
        error?: string;
      };
      if (!res.ok || !data.data) throw new Error(data.error ?? "Upload failed");
      setUrl(data.data.url);
      setPublicId(data.data.publicId);
      if (!title) setTitle(file.name.replace(/\.[^.]+$/, ""));
      toast.success("Uploaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-bd bg-surf p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-t">Add to library</h2>
        <p className="mt-0.5 text-[11px] text-t3">
          Save a link or upload an image. Either kind can later be pushed into a classroom.
        </p>

        <div className="mt-4 flex gap-1 rounded-lg bg-panel p-1">
          {(["link", "image"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setKind(k)}
              className={`flex-1 rounded-md px-3 py-1.5 text-[11px] font-medium capitalize ${
                kind === k ? "bg-surf text-t shadow-sm" : "text-t3"
              }`}
            >
              {k}
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            const t = title.trim();
            const u = url.trim();
            if (t.length < 1 || u.length < 1) {
              toast.error("Title and URL are required");
              return;
            }
            create.mutate({
              kind,
              title: t,
              url: u,
              description: description.trim() || undefined,
              publicId,
              tags: tags
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            });
          }}
          className="mt-4 space-y-3"
        >
          <Input
            label="Title"
            value={title}
            onChange={setTitle}
            placeholder="Algebra Chapter 3 worksheet"
          />

          {kind === "link" ? (
            <Input
              label="URL"
              value={url}
              onChange={setUrl}
              placeholder="https://…"
              type="url"
            />
          ) : (
            <div>
              <label className="mb-1 block text-[10.5px] font-bold uppercase tracking-wide text-t3">
                Image
              </label>
              {url ? (
                <div className="flex items-center gap-3 rounded-lg border border-bd bg-panel p-2">
                  <Image
                    src={url}
                    alt="uploaded"
                    width={64}
                    height={64}
                    className="rounded-md object-cover"
                    unoptimized
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setUrl("");
                      setPublicId(undefined);
                    }}
                    className="text-[11px] text-red hover:underline"
                  >
                    Replace
                  </button>
                </div>
              ) : (
                <label
                  className="flex h-24 cursor-pointer items-center justify-center rounded-lg border border-dashed border-bd bg-panel text-[11px] text-t3 hover:bg-panel2"
                >
                  {uploading ? "Uploading…" : "Click to upload (≤ 8 MB)"}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleFile(f);
                    }}
                  />
                </label>
              )}
            </div>
          )}

          <Input
            label="Description (optional)"
            value={description}
            onChange={setDescription}
            placeholder="One sentence on what this covers"
          />
          <Input
            label="Tags (comma-separated)"
            value={tags}
            onChange={setTags}
            placeholder="algebra, worksheet, chapter3"
          />

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
              disabled={create.isPending || uploading}
              className="rounded-lg bg-acc px-3 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {create.isPending ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PushModal({
  resource,
  onClose,
}: {
  resource: Resource | null;
  onClose: () => void;
}) {
  const { data: classrooms } = useClassrooms();
  const push = useMutation({
    mutationFn: ({ id, classroomId }: { id: string; classroomId: string }) =>
      api.post(`/teacher/resources/${id}/push`, { classroomId }),
    onSuccess: () => {
      toast.success("Pushed to classroom resources");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!resource) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-bd bg-surf p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-t">Push to a classroom</h2>
        <p className="mt-0.5 text-[11px] text-t3">
          Copies “{resource.title}” into the classroom’s Resources tab so students
          can see it.
        </p>

        {!classrooms?.length ? (
          <p className="mt-4 text-[11px] text-t3">
            You don’t have any classrooms yet.
          </p>
        ) : (
          <ul className="mt-4 max-h-72 space-y-1 overflow-y-auto">
            {classrooms.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => push.mutate({ id: resource.id, classroomId: c.id })}
                  disabled={push.isPending}
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

function Input({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-[10.5px] font-bold uppercase tracking-wide text-t3">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-bd bg-panel px-3 py-2 text-[12px] text-t outline-none focus:border-acc"
      />
    </div>
  );
}
