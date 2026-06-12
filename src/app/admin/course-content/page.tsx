"use client";
export const dynamic = "force-dynamic";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  FileSpreadsheet,
  Upload,
  Trash2,
  Loader2,
  Check,
  ExternalLink,
  BookOpen,
} from "lucide-react";
import { format } from "date-fns";
import api from "@/lib/api/client";
import { FALLBACK_SUBJECTS } from "@/shared/constants/subjects";

type Item = { topic: string; grade?: string; syllabus?: string; link: string };
type CourseContent = {
  subjectKey: string;
  subjectId?: string;
  subjectName: string;
  fileName?: string;
  itemCount: number;
  items: Item[];
  updatedAt: string;
};

const OTHER = "__other__";

/** Parse the first sheet of an .xlsx into Topic/Grade/syllabus/Link rows.
 *  Detects columns by header name, falling back to positional order. */
async function parseWorkbook(file: File): Promise<Item[]> {
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return [];
  const rows = XLSX.utils.sheet_to_json<string[]>(ws, {
    header: 1,
    blankrows: false,
    defval: "",
  });
  if (rows.length < 2) return [];

  const header = rows[0].map((h) => String(h).trim().toLowerCase());
  const find = (kw: string) => header.findIndex((h) => h.includes(kw));
  let ti = find("topic");
  let gi = find("grade");
  let si = find("syllab");
  let li = find("link");
  if (ti < 0) ti = 0;
  if (gi < 0) gi = 1;
  if (si < 0) si = 2;
  if (li < 0) li = 3;

  const out: Item[] = [];
  for (const r of rows.slice(1)) {
    const topic = String(r[ti] ?? "").trim();
    const link = String(r[li] ?? "").trim();
    if (!topic || !/^https?:\/\//i.test(link)) continue;
    out.push({
      topic,
      grade: String(r[gi] ?? "").trim(),
      syllabus: String(r[si] ?? "").trim(),
      link,
    });
  }
  return out;
}

export default function AdminCourseContentPage() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [subjectChoice, setSubjectChoice] = useState<string>(
    FALLBACK_SUBJECTS[0].id,
  );
  const [customName, setCustomName] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [parsing, setParsing] = useState(false);

  const listQ = useQuery({
    queryKey: ["admin", "course-content"],
    queryFn: () =>
      api.get("/admin/course-content") as Promise<CourseContent[]>,
  });

  const subjectName =
    subjectChoice === OTHER
      ? customName.trim()
      : (FALLBACK_SUBJECTS.find((s) => s.id === subjectChoice)?.name ?? "");
  const subjectId = subjectChoice === OTHER ? "" : subjectChoice;

  const saveMut = useMutation({
    mutationFn: () =>
      api.post("/admin/course-content", {
        subjectId: subjectId || undefined,
        subjectName,
        fileName: fileName ?? undefined,
        items,
      }) as Promise<CourseContent>,
    onSuccess: () => {
      toast.success(`Saved ${items.length} items for ${subjectName}`);
      qc.invalidateQueries({ queryKey: ["admin", "course-content"] });
      setItems([]);
      setFileName(null);
      if (fileRef.current) fileRef.current.value = "";
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const delMut = useMutation({
    mutationFn: (key: string) =>
      api.delete(`/admin/course-content?key=${encodeURIComponent(key)}`) as Promise<unknown>,
    onSuccess: () => {
      toast.success("Removed");
      qc.invalidateQueries({ queryKey: ["admin", "course-content"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setParsing(true);
    setFileName(file.name);
    try {
      const parsed = await parseWorkbook(file);
      if (parsed.length === 0) {
        toast.error("No Topic/Link rows found in that sheet.");
        setItems([]);
      } else {
        setItems(parsed);
        // If the subject is still on the default, try to seed it from the
        // filename (e.g. "further_math.xlsx" → "further math").
        if (subjectChoice !== OTHER && !customName) {
          const guess = file.name
            .replace(/\.xlsx?$/i, "")
            .replace(/[-_]+/g, " ")
            .trim();
          if (guess) {
            setSubjectChoice(OTHER);
            setCustomName(guess.replace(/\b\w/g, (c) => c.toUpperCase()));
          }
        }
      }
    } catch {
      toast.error("Couldn't read that file. Use a .xlsx export.");
      setItems([]);
    } finally {
      setParsing(false);
    }
  };

  const canSave = !!subjectName && items.length > 0 && !saveMut.isPending;

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-[1100px] space-y-6">
        {/* Upload card */}
        <section className="rounded-2xl border border-bd bg-surf p-5">
          <div className="mb-4 flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-bbg">
              <FileSpreadsheet className="h-4 w-4 text-bt" />
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-t">Upload course content</h2>
              <p className="text-[12px] text-t3">
                Excel sheet with columns: Topic · Grade · Syllabus · Link (Google Drive).
                One file per subject — re-uploading replaces it.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-[220px_1fr]">
            {/* Subject */}
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-t2">
                Subject
              </label>
              <select
                value={subjectChoice}
                onChange={(e) => setSubjectChoice(e.target.value)}
                className="w-full rounded-lg border border-bd bg-panel px-2.5 py-2 text-[12px] text-t outline-none focus:border-acc"
              >
                {FALLBACK_SUBJECTS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
                <option value={OTHER}>Other (type name)…</option>
              </select>
              {subjectChoice === OTHER && (
                <input
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="e.g. Further Math"
                  className="mt-2 w-full rounded-lg border border-bd bg-panel px-2.5 py-2 text-[12px] text-t outline-none focus:border-acc"
                />
              )}
            </div>

            {/* File */}
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-t2">
                Excel file (.xlsx)
              </label>
              <div className="flex items-center gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => onFile(e.target.files?.[0])}
                  className="block w-full cursor-pointer rounded-lg border border-bd bg-panel text-[12px] text-t2 file:mr-3 file:cursor-pointer file:border-0 file:bg-bbg file:px-3 file:py-2 file:text-[12px] file:font-semibold file:text-bt"
                />
                {parsing && <Loader2 className="h-4 w-4 animate-spin text-t3" />}
              </div>
              {fileName && !parsing && (
                <p className="mt-1.5 text-[11px] text-t3">
                  {fileName} — <span className="font-semibold text-t2">{items.length}</span>{" "}
                  topics parsed
                </p>
              )}
            </div>
          </div>

          {/* Preview */}
          {items.length > 0 && (
            <div className="mt-4 overflow-hidden rounded-xl border border-bd">
              <div className="max-h-[280px] overflow-y-auto">
                <table className="w-full text-left text-[12px]">
                  <thead className="sticky top-0 bg-panel text-[10px] uppercase tracking-wide text-t3">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Topic</th>
                      <th className="px-3 py-2 font-semibold">Grade</th>
                      <th className="px-3 py-2 font-semibold">Syllabus</th>
                      <th className="px-3 py-2 font-semibold">Link</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it, i) => (
                      <tr key={i} className="border-t border-bd">
                        <td className="px-3 py-1.5 font-medium text-t">{it.topic}</td>
                        <td className="px-3 py-1.5 text-t2">{it.grade || "—"}</td>
                        <td className="px-3 py-1.5 text-t2">{it.syllabus || "—"}</td>
                        <td className="max-w-[260px] truncate px-3 py-1.5 text-t3">
                          <a
                            href={it.link}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="inline-flex items-center gap-1 hover:text-acc"
                          >
                            <ExternalLink className="h-3 w-3" />
                            open
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="mt-4 flex justify-end">
            <button
              onClick={() => saveMut.mutate()}
              disabled={!canSave}
              className="inline-flex items-center gap-1.5 rounded-lg bg-acc px-4 py-2 text-[12px] font-semibold text-white disabled:opacity-40"
            >
              {saveMut.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              Save for {subjectName || "subject"}
            </button>
          </div>
        </section>

        {/* Existing content */}
        <section className="rounded-2xl border border-bd bg-surf p-5">
          <h2 className="mb-3 flex items-center gap-2 text-[14px] font-bold text-t">
            <BookOpen className="h-4 w-4 text-t2" />
            Published content by subject
          </h2>
          {listQ.isLoading ? (
            <p className="py-6 text-center text-[12px] text-t3">Loading…</p>
          ) : !listQ.data?.length ? (
            <p className="py-6 text-center text-[12px] text-t3">
              No course content uploaded yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {listQ.data.map((c) => (
                <li
                  key={c.subjectKey}
                  className="flex items-center gap-3 rounded-xl border border-bd bg-panel px-4 py-3"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gbg">
                    <Check className="h-4 w-4 text-gt" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-t">
                      {c.subjectName}
                    </p>
                    <p className="truncate text-[11px] text-t3">
                      {c.itemCount} topics
                      {c.fileName ? ` · ${c.fileName}` : ""} · updated{" "}
                      {format(new Date(c.updatedAt), "MMM d, yyyy")}
                    </p>
                  </div>
                  <button
                    onClick={() => delMut.mutate(c.subjectKey)}
                    disabled={delMut.isPending && delMut.variables === c.subjectKey}
                    className="rounded-lg p-1.5 text-t3 hover:bg-rbg hover:text-rt disabled:opacity-50"
                    aria-label="Delete"
                  >
                    {delMut.isPending && delMut.variables === c.subjectKey ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
