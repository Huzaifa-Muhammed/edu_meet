"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, X, Loader2, Check, Plus, FolderOpen } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api/client";
import { gradeMatches, syllabusMatches } from "@/shared/constants/curriculum";

export type CourseDoc = {
  topic: string;
  grade?: string;
  syllabus?: string;
  link: string;
};

export type CourseContentResponse = {
  subjectName: string;
  available: boolean;
  fileName: string | null;
  updatedAt: string | null;
  items: CourseDoc[];
  classroomGrade?: number | null;
  classroomSyllabus?: string | null;
};

export function useCourseContent(classroomId: string) {
  return useQuery<CourseContentResponse>({
    queryKey: ["course-content", classroomId],
    queryFn: () =>
      api.get(
        `/classrooms/${classroomId}/course-content`,
      ) as unknown as Promise<CourseContentResponse>,
    enabled: !!classroomId,
    staleTime: 60_000,
  });
}

/** Shared list of a subject's course docs. The parent supplies the per-row
 *  action (e.g. "Add to class" in resources, "Present" in slides). */
export function CourseContentList({
  classroomId,
  dark,
  renderAction,
}: {
  classroomId: string;
  dark?: boolean;
  renderAction: (doc: CourseDoc) => React.ReactNode;
}) {
  const { data, isLoading } = useCourseContent(classroomId);
  const [showAll, setShowAll] = useState(false);

  const muted = dark ? "text-white/50" : "text-t3";
  const strong = dark ? "text-white" : "text-t";
  const rowCls = dark
    ? "border-white/10 bg-white/5"
    : "border-bd bg-surf";
  const badgeCls = dark
    ? "bg-white/10 text-white/70"
    : "bg-panel text-t2";
  const linkCls = dark ? "text-white/70 hover:text-white" : "text-acc hover:underline";

  // Items matching this class's grade + exam board (blank item metadata is a
  // wildcard, so unlabeled docs always pass). Defaults to the matched subset;
  // "Show all" reveals everything so nothing is ever permanently hidden.
  const matched = useMemo(
    () =>
      (data?.items ?? []).filter(
        (doc) =>
          gradeMatches(data?.classroomGrade ?? undefined, doc.grade) &&
          syllabusMatches(data?.classroomSyllabus ?? undefined, doc.syllabus),
      ),
    [data?.items, data?.classroomGrade, data?.classroomSyllabus],
  );

  if (isLoading) {
    return <p className={`py-6 text-center text-[11px] ${muted}`}>Loading…</p>;
  }
  if (!data?.available || data.items.length === 0) {
    return (
      <p className={`py-6 text-center text-[11px] leading-[1.6] ${muted}`}>
        No course content has been uploaded for{" "}
        <span className="font-semibold">{data?.subjectName || "this subject"}</span>{" "}
        yet. An admin can add it from the Course Content page.
      </p>
    );
  }

  const hasFilter = matched.length !== data.items.length;
  const noMatch = matched.length === 0;
  const shown = showAll || noMatch ? data.items : matched;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <p className={`text-[10px] uppercase tracking-[.6px] ${muted}`}>
          {data.subjectName} · {shown.length} document
          {shown.length === 1 ? "" : "s"}
        </p>
        {hasFilter && !noMatch && (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className={`text-[10px] font-semibold ${linkCls}`}
          >
            {showAll
              ? `Show match only (${matched.length})`
              : `Show all (${data.items.length})`}
          </button>
        )}
      </div>
      {noMatch && (
        <p className={`text-[10px] leading-[1.5] ${muted}`}>
          No documents match this class&apos;s grade/board — showing all.
        </p>
      )}
      {shown.map((doc, i) => (
        <div
          key={`${doc.link}-${i}`}
          className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 ${rowCls}`}
        >
          <div className="min-w-0 flex-1">
            <p className={`truncate text-[11.5px] font-semibold ${strong}`}>
              {doc.topic}
            </p>
            <div className="mt-0.5 flex flex-wrap items-center gap-1">
              {doc.grade && (
                <span className={`rounded px-1.5 py-px text-[9px] font-medium ${badgeCls}`}>
                  Grade {doc.grade}
                </span>
              )}
              {doc.syllabus && (
                <span className={`rounded px-1.5 py-px text-[9px] font-medium ${badgeCls}`}>
                  {doc.syllabus}
                </span>
              )}
            </div>
          </div>
          <a
            href={doc.link}
            target="_blank"
            rel="noreferrer noopener"
            className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md ${
              dark ? "text-white/50 hover:text-white" : "text-t3 hover:text-acc"
            }`}
            title="Open in Drive"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
          {renderAction(doc)}
        </div>
      ))}
    </div>
  );
}

/** Modal used by the classroom Resources tab: browse subject docs and add any
 *  of them as a class resource link (so students can reference them). */
export function ImportContentModal({
  classroomId,
  onClose,
}: {
  classroomId: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [added, setAdded] = useState<Set<string>>(new Set());

  const addMut = useMutation({
    mutationFn: (doc: CourseDoc) =>
      api.post(`/classrooms/${classroomId}/resources`, {
        kind: "link",
        title: doc.topic,
        url: doc.link,
        description: [doc.syllabus, doc.grade ? `Grade ${doc.grade}` : ""]
          .filter(Boolean)
          .join(" · "),
      }),
    onSuccess: (_d, doc) => {
      setAdded((s) => new Set(s).add(doc.link));
      qc.invalidateQueries({ queryKey: ["resources", classroomId] });
      toast.success(`Added "${doc.topic}" to class resources`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div
      className="fixed inset-0 z-[300] flex items-start justify-center overflow-y-auto p-6"
      style={{ background: "rgba(15,14,12,.7)" }}
      onClick={onClose}
    >
      <div
        className="mx-auto mt-[6vh] w-full max-w-[560px] overflow-hidden rounded-[14px] bg-surf"
        style={{ boxShadow: "0 32px 100px rgba(0,0,0,.45)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 border-b border-bd px-4 py-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-abg">
            <FolderOpen className="h-4 w-4 text-at" />
          </div>
          <div className="flex-1">
            <p className="text-[13px] font-bold text-t">Import course content</p>
            <p className="text-[10px] text-t3">
              Add subject documents to this class for students to reference.
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-bd bg-panel text-t3 hover:text-t"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-4">
          <CourseContentList
            classroomId={classroomId}
            renderAction={(doc) => {
              const isAdded = added.has(doc.link);
              const busy = addMut.isPending && addMut.variables?.link === doc.link;
              return (
                <button
                  onClick={() => !isAdded && addMut.mutate(doc)}
                  disabled={isAdded || busy}
                  className={`flex flex-shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold ${
                    isAdded
                      ? "bg-gbg text-gt"
                      : "bg-acc text-white hover:opacity-90 disabled:opacity-50"
                  }`}
                >
                  {busy ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : isAdded ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <Plus className="h-3 w-3" />
                  )}
                  {isAdded ? "Added" : "Add to class"}
                </button>
              );
            }}
          />
        </div>
      </div>
    </div>
  );
}
