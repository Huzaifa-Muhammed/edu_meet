"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import api from "@/lib/api/client";

type Tab = "agenda" | "notes" | "resources";

type AgendaItem = {
  id: string;
  title: string;
  description?: string;
  done: boolean;
  order: number;
};

type ResourceItem = {
  id: string;
  title: string;
  url: string;
  kind: "link" | "doc";
};

type ClassNote = {
  id: string;
  text: string;
  authorRole?: string;
  authorName?: string;
  createdAt: string;
};

type PrivateNote = {
  id: string;
  text: string;
  tags: string[];
  shared?: boolean;
  createdAt: string;
};

const NOTE_TAGS = [
  { id: "all", label: "All", badgeBg: "#D0DAE8", badgeFg: "#4A5C6E" },
  { id: "def", label: "📘 Def", badgeBg: "#E6F2FB", badgeFg: "#135E9A", badgeBd: "#90C8EE" },
  { id: "method", label: "✅ Method", badgeBg: "#E8FAF2", badgeFg: "#0B7A49", badgeBd: "#7EDBB5" },
  { id: "question", label: "❓ Question", badgeBg: "#FEF6E4", badgeFg: "#7A4D08", badgeBd: "#F5D07A" },
];

export function StudentLeftPanel({
  classroomId,
  meetingId,
  subjectName,
}: {
  classroomId: string;
  meetingId: string;
  subjectName?: string;
}) {
  const [tab, setTab] = useState<Tab>("agenda");

  return (
    <aside className="lp">
      <div className="lp-hdr">
        <span style={{ fontSize: 14 }}>📚</span>
        <span className="lp-hdr-title">Today&apos;s lesson</span>
        {subjectName && <span className="subj-badge">{subjectName}</span>}
      </div>
      <div className="lp-tabs">
        {(
          [
            { id: "agenda", label: "Agenda" },
            { id: "notes", label: "My Notes" },
            { id: "resources", label: "Resources" },
          ] as { id: Tab; label: string }[]
        ).map((t) => (
          <div
            key={t.id}
            className={`lpt${tab === t.id ? " on" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </div>
        ))}
      </div>
      <div className={`lp-body${tab === "agenda" ? " on" : ""}`}>
        <AgendaTab classroomId={classroomId} />
      </div>
      <div className={`lp-body${tab === "notes" ? " on" : ""}`}>
        <NotesTab classroomId={classroomId} meetingId={meetingId} />
      </div>
      <div className={`lp-body${tab === "resources" ? " on" : ""}`}>
        <ResourcesTab classroomId={classroomId} />
      </div>
    </aside>
  );
}

/* ─────────── Agenda ─────────── */

function AgendaTab({ classroomId }: { classroomId: string }) {
  const q = useQuery<AgendaItem[]>({
    queryKey: ["agenda", classroomId],
    queryFn: () =>
      api.get(`/classrooms/${classroomId}/agenda`) as unknown as Promise<AgendaItem[]>,
    refetchInterval: 20_000,
  });
  const items = q.data ?? [];
  const done = items.filter((i) => i.done).length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;
  const currentIdx = items.findIndex((i) => !i.done);
  const [openSet, setOpenSet] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setOpenSet((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <>
      <div className="prog-bar">
        <div className="prog-row">
          <span>Lesson progress</span>
          <span>
            {items.length > 0
              ? `Topic ${Math.max(1, currentIdx + 1)} of ${items.length}`
              : "Not started"}
          </span>
        </div>
        <div className="prog-track">
          <div className="prog-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {items.length === 0 ? (
        <div style={{ padding: "12px 14px" }}>
          {["Introduction", "Today's topic", "Practice", "Wrap-up"].map((ph, i) => (
            <div key={ph} className="topic">
              <div className={`topic-hdr${i === 1 ? " cur" : ""}`}>
                <div className={`tdot${i === 1 ? " cur" : ""}`} />
                <div className="tlbl">
                  <div className="ttitle">{ph}</div>
                  <div className="tsub" style={{ opacity: 0.7 }}>
                    {i === 1 ? "In progress" : "Awaiting teacher"}
                  </div>
                </div>
                <span className="tchev">›</span>
              </div>
            </div>
          ))}
          <p
            style={{
              marginTop: 12,
              padding: "10px 12px",
              textAlign: "center",
              fontSize: 10,
              color: "rgba(255,255,255,0.45)",
              lineHeight: 1.6,
              background: "rgba(255,255,255,0.04)",
              border: "1px dashed rgba(255,255,255,0.15)",
              borderRadius: 10,
            }}
          >
            Teacher hasn&apos;t set a live agenda yet. Topics above are placeholders.
          </p>
        </div>
      ) : (
        items.map((item, i) => {
          const isCurrent = !item.done && i === currentIdx;
          const isOpen = openSet.has(item.id);
          return (
            <div key={item.id} className="topic">
              <div
                className={`topic-hdr${isCurrent ? " cur" : ""}`}
                onClick={() => toggle(item.id)}
              >
                <div
                  className={`tdot${item.done ? " done" : isCurrent ? " cur" : ""}`}
                />
                <div className="tlbl">
                  <div className="ttitle">{item.title}</div>
                  <div className="tsub">
                    {item.done ? "Complete" : isCurrent ? "In progress" : "Upcoming"}
                  </div>
                </div>
                <span className={`tchev${isOpen ? " open" : ""}`}>›</span>
              </div>
              <div className={`drawer${isOpen ? " open" : ""}`}>
                {item.description ? (
                  <div className="sub-item">
                    <div className={`si-check${item.done ? " done" : isCurrent ? " cur" : ""}`}>
                      {item.done ? "✓" : ""}
                    </div>
                    <span className="si-n">{item.description}</span>
                  </div>
                ) : (
                  <div className="sub-item">
                    <span className="si-n" style={{ color: "#8A9BAD", fontStyle: "italic" }}>
                      No details
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })
      )}
    </>
  );
}

/* ─────────── Notes ─────────── */

function NotesTab({ classroomId, meetingId }: { classroomId: string; meetingId: string }) {
  const [view, setView] = useState<"mine" | "public">("mine");
  const [activeTag, setActiveTag] = useState("all");
  const [text, setText] = useState("");
  const qc = useQueryClient();

  const mineQ = useQuery<PrivateNote[]>({
    queryKey: ["student-private-notes", meetingId],
    queryFn: () =>
      api.get(`/student/notes?meetingId=${meetingId}`) as unknown as Promise<PrivateNote[]>,
    enabled: view === "mine",
  });
  const classQ = useQuery<ClassNote[]>({
    queryKey: ["class-notes", classroomId],
    queryFn: () =>
      api.get(`/classrooms/${classroomId}/notes`) as unknown as Promise<ClassNote[]>,
    enabled: view === "public",
    refetchInterval: 20_000,
  });

  const savePrivate = useMutation({
    mutationFn: () => {
      const tag = activeTag === "all" ? null : activeTag;
      return api.post("/student/notes", {
        meetingId,
        text,
        tags: tag ? [tag] : [],
      });
    },
    onSuccess: () => {
      toast.success("Note saved");
      setText("");
      qc.invalidateQueries({ queryKey: ["student-private-notes", meetingId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const shareMut = useMutation({
    mutationFn: (note: PrivateNote) =>
      api.post(`/classrooms/${classroomId}/notes`, {
        text: note.text,
      }),
    onSuccess: () => {
      toast.success("Shared with class");
      qc.invalidateQueries({ queryKey: ["class-notes", classroomId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const mineFiltered = useMemo(() => {
    const all = mineQ.data ?? [];
    if (activeTag === "all") return all;
    return all.filter((n) => n.tags.includes(activeTag));
  }, [mineQ.data, activeTag]);

  const save = () => {
    if (!text.trim() || savePrivate.isPending) return;
    savePrivate.mutate();
  };

  return (
    <>
      <div className="notes-view-tabs">
        <div
          className={`nvt${view === "mine" ? " active" : ""}`}
          onClick={() => setView("mine")}
        >
          🔒 My Notes
        </div>
        <div
          className={`nvt${view === "public" ? " active" : ""}`}
          onClick={() => setView("public")}
        >
          🌍 Class Notes
        </div>
      </div>

      {view === "mine" ? (
        <div className="notes-section active">
          <div className="notes-pad">
            <div className="note-tags">
              {NOTE_TAGS.map((t) => (
                <button
                  key={t.id}
                  className={`ntag${activeTag === t.id ? " on" : ""}`}
                  onClick={() => setActiveTag(t.id)}
                  style={
                    activeTag === t.id
                      ? undefined
                      : t.id === "all"
                        ? undefined
                        : {
                            background: t.badgeBg,
                            color: t.badgeFg,
                            borderColor: t.badgeBd,
                          }
                  }
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="note-inp-row">
              <input
                className="note-inp"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && save()}
                placeholder="Type a note…"
              />
              <button className="note-add" onClick={save} aria-label="Add note">
                +
              </button>
            </div>
            <div>
              {mineFiltered.length === 0 ? (
                <p style={{ textAlign: "center", fontSize: 10, color: "#8A9BAD", padding: 12 }}>
                  {(mineQ.data ?? []).length === 0
                    ? "No private notes yet. They stay on your account only."
                    : "No notes match this tag."}
                </p>
              ) : (
                mineFiltered.map((n) => (
                  <div key={n.id} className="note-card">
                    <div className="note-card-top">
                      {n.tags.map((tagId) => {
                        const def = NOTE_TAGS.find((x) => x.id === tagId);
                        if (!def) return null;
                        return (
                          <span
                            key={tagId}
                            className="note-tag-badge"
                            style={{
                              background: def.badgeBg,
                              color: def.badgeFg,
                              border: `1px solid ${def.badgeBd ?? def.badgeBg}`,
                            }}
                          >
                            {def.label}
                          </span>
                        );
                      })}
                      <span className="note-time">
                        {format(new Date(n.createdAt), "h:mm a")}
                      </span>
                    </div>
                    <div className="note-text">{n.text}</div>
                    <div className="note-actions">
                      <span className={`note-vis${n.shared ? " shared" : " private"}`}>
                        {n.shared ? "🌍 Shared with class" : "🔒 Private"}
                      </span>
                      {!n.shared && (
                        <button
                          className="note-share-btn"
                          onClick={() => shareMut.mutate(n)}
                          disabled={shareMut.isPending}
                        >
                          Share with class →
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="notes-section active">
          <div className="notes-public-hdr">
            <span className="notes-public-lbl">Notes shared by classmates</span>
            <span className="notes-public-count">
              {(classQ.data ?? []).length} note{(classQ.data ?? []).length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="notes-public-list">
            {(classQ.data ?? []).length === 0 ? (
              <div className="notes-empty">
                <div style={{ fontSize: 24, marginBottom: 6 }}>📝</div>
                <div>No class notes yet.</div>
                <div style={{ marginTop: 4, fontSize: 10 }}>
                  Share one of yours to start!
                </div>
              </div>
            ) : (
              (classQ.data ?? []).map((n) => (
                <div key={n.id} className="note-card public-card">
                  <div className="note-card-top">
                    <span className="note-time">
                      {format(new Date(n.createdAt), "h:mm a")}
                    </span>
                  </div>
                  <div className="note-text">{n.text}</div>
                  <div className="note-author">
                    <div
                      className="note-author-av"
                      style={{
                        background: n.authorRole === "teacher" ? "#F0EAFA" : "#D1FAE5",
                        color: n.authorRole === "teacher" ? "#4E2E9A" : "#065F46",
                      }}
                    >
                      {(n.authorName ?? "?").slice(0, 2).toUpperCase()}
                    </div>
                    <span>
                      {n.authorName ?? "Student"}
                      {n.authorRole === "teacher" && " (Teacher)"}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </>
  );
}

/* ─────────── Resources ─────────── */

function ResourcesTab({ classroomId }: { classroomId: string }) {
  const q = useQuery<ResourceItem[]>({
    queryKey: ["resources", classroomId],
    queryFn: () =>
      api.get(`/classrooms/${classroomId}/resources`) as unknown as Promise<ResourceItem[]>,
    refetchInterval: 20_000,
  });
  const items = q.data ?? [];

  const iconBgs = ["#F0EAFA", "#E6F2FB", "#E8FAF2", "#FEF6E4", "#FDEAEA"];
  const iconEmojis = ["📑", "📄", "🔗", "📊", "📎"];

  return (
    <div className="res-pad">
      <div className="res-section-lbl">From today&apos;s lesson</div>
      {items.length === 0 ? (
        <p style={{ fontSize: 10, color: "#8A9BAD", lineHeight: 1.6 }}>
          Your teacher hasn&apos;t shared any resources for this class yet.
        </p>
      ) : (
        items.map((r, i) => (
          <div key={r.id} className="res-item">
            <div
              className="res-ico"
              style={{ background: iconBgs[i % iconBgs.length] }}
            >
              {iconEmojis[i % iconEmojis.length]}
            </div>
            <div className="res-info">
              <div className="res-title">{r.title}</div>
              <div className="res-sub">
                {(() => {
                  try {
                    return new URL(r.url).host;
                  } catch {
                    return r.kind === "doc" ? "Document" : "Link";
                  }
                })()}
              </div>
            </div>
            <a
              href={r.url}
              target="_blank"
              rel="noreferrer noopener"
              className="res-btn"
            >
              Open
            </a>
          </div>
        ))
      )}
    </div>
  );
}
