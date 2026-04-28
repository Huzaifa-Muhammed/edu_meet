"use client";

import { useEffect, useRef, useState } from "react";
import { usePubSub } from "@videosdk.live/react-sdk";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Pen,
  Settings,
  Upload,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { getFirebaseAuth } from "@/lib/firebase/client";
import api from "@/lib/api/client";

/* ─── Types ─── */

type ServerSlide = {
  id: string;
  filename: string;
  url: string;
  idx: number;
};

/* ─── Pen state ─── */
type PenTool = "pen" | "marker" | "eraser";
const COLORS = ["#FACC15", "#F87171", "#4ADE80", "#60A5FA", "#E879F9", "#FFFFFF"];
const SIZES = [3, 6, 12];

type Stroke = {
  tool: PenTool;
  color: string;
  size: number;
  pts: { x: number; y: number }[];
  slide: number;
};

/** In-class slide presenter.
 *  Teacher uploads images + PDFs (split in-browser via pdfjs → PNG blobs) to
 *  /api/meetings/[id]/slides (Firebase Storage). Students fetch the same list
 *  and see real slide images. Slide index + pen strokes sync via SLIDE /
 *  SLIDE_PEN pubsub. */
export function SlidePresenter({
  meetingId,
  onClose,
  canEdit = true,
}: {
  meetingId: string;
  onClose: () => void;
  canEdit?: boolean;
}) {
  const qc = useQueryClient();
  const slidesQ = useQuery<ServerSlide[]>({
    queryKey: ["meeting-slides", meetingId],
    queryFn: () =>
      api.get(`/meetings/${meetingId}/slides`) as unknown as Promise<ServerSlide[]>,
    enabled: !!meetingId,
    refetchInterval: canEdit ? false : 15_000,
  });
  const slides = slidesQ.data ?? [];
  const [idx, setIdx] = useState(0);
  const [penOn, setPenOn] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [tool, setTool] = useState<PenTool>("pen");
  const [color, setColor] = useState(COLORS[0]);
  const [size, setSize] = useState(SIZES[0]);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const drawing = useRef<{ active: boolean; stroke: Stroke | null }>({
    active: false,
    stroke: null,
  });

  // Slide sync + pen broadcast (index/strokes only — slide content stays local)
  const { publish: publishSlide, messages: slideMsgs } = usePubSub("SLIDE");
  const { publish: publishStroke, messages: strokeMsgs } = usePubSub("SLIDE_PEN");

  // Non-editors follow latest slide idx
  useEffect(() => {
    if (canEdit) return;
    const last = slideMsgs[slideMsgs.length - 1];
    if (!last) return;
    const next = Number(last.message);
    if (!Number.isNaN(next)) setIdx(next);
  }, [slideMsgs.length, canEdit]);

  // Teacher broadcasts idx changes (once slides are loaded)
  useEffect(() => {
    if (!canEdit) return;
    if (slides.length === 0) return;
    publishSlide(String(idx), { persist: true });
  }, [idx, canEdit, slides.length, publishSlide]);

  // Keyboard nav
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!canEdit) return;
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      if (e.key === "ArrowLeft") setIdx((i) => Math.max(0, i - 1));
      else if (e.key === "ArrowRight")
        setIdx((i) => Math.min(slides.length - 1, i + 1));
      else if (e.key === "Escape") onClose();
      else if (e.key.toLowerCase() === "p") setPenOn((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, canEdit, slides.length]);

  // Replay strokes from pubsub
  useEffect(() => {
    const out: Stroke[] = [];
    const seen = new Set<string>();
    for (const m of strokeMsgs) {
      try {
        const parsed = JSON.parse(m.message as unknown as string) as Stroke & {
          strokeId?: string;
        };
        if (parsed.strokeId && seen.has(parsed.strokeId)) continue;
        if (parsed.strokeId) seen.add(parsed.strokeId);
        out.push(parsed);
      } catch {
        // skip
      }
    }
    setStrokes(out);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strokeMsgs.length]);

  // Resize canvas
  useEffect(() => {
    const resize = () => {
      const c = canvasRef.current;
      const w = wrapRef.current;
      if (!c || !w) return;
      c.width = w.clientWidth;
      c.height = w.clientHeight;
      redraw();
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, strokes]);

  const slidesForCurrent = strokes.filter((s) => s.slide === idx);

  const redraw = () => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    for (const s of slidesForCurrent) drawStroke(ctx, s);
  };

  const drawStroke = (ctx: CanvasRenderingContext2D, s: Stroke) => {
    if (s.pts.length < 2) return;
    const c = canvasRef.current;
    if (!c) return;
    const w = c.width;
    const h = c.height;
    ctx.strokeStyle = s.color;
    ctx.lineWidth = s.size;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.globalAlpha = s.tool === "marker" ? 0.45 : 1;
    ctx.globalCompositeOperation =
      s.tool === "eraser" ? "destination-out" : "source-over";
    ctx.beginPath();
    ctx.moveTo(s.pts[0].x * w, s.pts[0].y * h);
    for (let i = 1; i < s.pts.length; i++)
      ctx.lineTo(s.pts[i].x * w, s.pts[i].y * h);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  };

  const startDraw = (x: number, y: number) => {
    const c = canvasRef.current;
    if (!c) return;
    const stroke: Stroke = {
      tool,
      color,
      size: tool === "eraser" ? size * 3 : size,
      pts: [{ x: x / c.width, y: y / c.height }],
      slide: idx,
    };
    drawing.current = { active: true, stroke };
  };

  const moveDraw = (x: number, y: number) => {
    const d = drawing.current;
    if (!d.active || !d.stroke) return;
    const c = canvasRef.current;
    if (!c) return;
    d.stroke.pts.push({ x: x / c.width, y: y / c.height });
    const ctx = c.getContext("2d");
    if (ctx) drawStroke(ctx, d.stroke);
  };

  const endDraw = () => {
    const d = drawing.current;
    if (!d.active || !d.stroke) return;
    const finished = d.stroke;
    setStrokes((s) => [...s, finished]);
    drawing.current = { active: false, stroke: null };
    if (canEdit) {
      publishStroke(
        JSON.stringify({ ...finished, strokeId: crypto.randomUUID() }),
        { persist: true },
      );
    }
  };

  const addFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;
    setUploadError(null);
    setUploading(true);
    setUploadStatus(null);

    try {
      // Convert each file (or PDF page) into a Blob we can upload.
      const blobs: { blob: Blob; filename: string }[] = [];
      for (const f of files) {
        if (f.type === "application/pdf" || /\.pdf$/i.test(f.name)) {
          setUploadStatus(`Reading ${f.name}…`);
          const pages = await pdfToImageBlobs(f);
          pages.forEach((blob, i) =>
            blobs.push({
              blob,
              filename: `${f.name.replace(/\.pdf$/i, "")}-p${i + 1}.png`,
            }),
          );
        } else if (
          f.type.startsWith("application/vnd.openxmlformats") ||
          /\.(pptx?|odp|key)$/i.test(f.name)
        ) {
          throw new Error(
            "PowerPoint / Keynote files aren't supported. Export your deck to PDF or images first.",
          );
        } else if (f.type.startsWith("image/")) {
          blobs.push({ blob: f, filename: f.name });
        } else {
          throw new Error(
            `Unsupported file: ${f.name}. Use PNG, JPG, WebP, or PDF.`,
          );
        }
      }
      if (blobs.length === 0) throw new Error("No valid files.");

      // Upload as a single multipart batch — API accepts repeated `files` field.
      setUploadStatus(`Uploading ${blobs.length} slide${blobs.length === 1 ? "" : "s"}…`);
      const form = new FormData();
      for (const b of blobs) form.append("files", b.blob, b.filename);
      const token = await getFirebaseAuth().currentUser?.getIdToken();
      const res = await fetch(`/api/meetings/${meetingId}/slides`, {
        method: "POST",
        body: form,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error?.message ?? `Upload failed (${res.status})`);
      }
      await qc.invalidateQueries({ queryKey: ["meeting-slides", meetingId] });
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Failed to load slides");
    } finally {
      setUploading(false);
      setUploadStatus(null);
    }
  };

  const removeSlide = async (slideId: string) => {
    try {
      await api.delete(`/meetings/${meetingId}/slides/${slideId}`);
      await qc.invalidateQueries({ queryKey: ["meeting-slides", meetingId] });
      const nextLen = Math.max(0, slides.length - 1);
      setIdx((i) => Math.min(i, Math.max(0, nextLen - 1)));
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Failed to remove slide");
    }
  };

  const current = slides[idx];
  const canPrev = idx > 0;
  const canNext = idx < slides.length - 1;

  // Empty state — show the 2 options
  if (slides.length === 0) {
    return (
      <div
        className="absolute inset-0 z-[8] flex flex-col"
        style={{ background: "#0F0E0C" }}
      >
        <div className="flex flex-shrink-0 items-center gap-2.5 border-b border-white/[.06] bg-black/35 px-3 py-1.5">
          <span className="flex-1 text-[11px] font-semibold text-white/70">
            Present slides
          </span>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-red-500/35 bg-red-600/25 text-red-300 hover:bg-red-600/45 hover:text-white"
            title="Close"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        {canEdit ? (
          <SlideSourcePicker
            onUpload={addFiles}
            uploading={uploading}
            uploadStatus={uploadStatus}
            uploadError={uploadError}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center text-[12px] text-white/50">
            Teacher hasn&apos;t started slides yet.
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className="absolute inset-0 z-[8] flex flex-col"
      style={{ background: "#0F0E0C" }}
      ref={wrapRef}
    >
      {/* Presenter bar */}
      <div className="flex flex-shrink-0 items-center gap-2.5 border-b border-white/[.06] bg-black/35 px-3 py-1.5">
        <span className="flex-1 text-[10px] font-medium text-white/40">
          Slide {idx + 1} of {slides.length}
        </span>
        {current && (
          <span
            className="max-w-[40%] truncate text-[10px] font-semibold text-white/65"
            title={current.filename}
          >
            {current.filename}
          </span>
        )}
        <span className="font-mono text-[9px] text-white/20">
          ← → keys to navigate
        </span>
      </div>

      {/* Slide canvas */}
      <div className="relative flex-1 overflow-hidden">
        {current ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={current.url}
              alt={current.filename}
              className="max-h-full max-w-full object-contain"
              draggable={false}
            />
          </div>
        ) : null}

        {/* Pen canvas overlay */}
        <canvas
          ref={canvasRef}
          onPointerDown={(e) => {
            if (!penOn || !canEdit) return;
            const r = (e.target as HTMLCanvasElement).getBoundingClientRect();
            startDraw(e.clientX - r.left, e.clientY - r.top);
          }}
          onPointerMove={(e) => {
            if (!penOn || !canEdit || !drawing.current.active) return;
            const r = (e.target as HTMLCanvasElement).getBoundingClientRect();
            moveDraw(e.clientX - r.left, e.clientY - r.top);
          }}
          onPointerUp={endDraw}
          onPointerLeave={endDraw}
          className="absolute inset-0 z-[15]"
          style={{
            display: penOn ? "block" : "none",
            cursor: penOn && canEdit ? "crosshair" : "default",
            touchAction: "none",
          }}
        />

        {/* Pen toolbar */}
        {penOn && canEdit && (
          <div
            className="absolute bottom-[52px] left-1/2 z-[16] flex -translate-x-1/2 items-center gap-1 rounded-[30px] border border-white/10 px-2 py-1.5 backdrop-blur"
            style={{ background: "rgba(15,14,12,.85)" }}
          >
            <ToolBtn on={tool === "pen"} onClick={() => setTool("pen")} title="Pen">
              ✏️
            </ToolBtn>
            <ToolBtn
              on={tool === "marker"}
              onClick={() => setTool("marker")}
              title="Marker"
            >
              🖊
            </ToolBtn>
            <ToolBtn
              on={tool === "eraser"}
              onClick={() => setTool("eraser")}
              title="Eraser"
            >
              ⬜
            </ToolBtn>
            <Sep />
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`h-5 w-5 flex-shrink-0 rounded-full border-2 transition-transform ${
                  color === c ? "scale-110 border-white" : "border-transparent"
                }`}
                style={{ background: c }}
                title={c}
              />
            ))}
            <Sep />
            {SIZES.map((s) => (
              <button
                key={s}
                onClick={() => setSize(s)}
                className="flex-shrink-0 rounded-full bg-white transition-opacity hover:opacity-70"
                style={{
                  width: `${4 + s * 1.2}px`,
                  height: `${4 + s * 1.2}px`,
                  outline: size === s ? "2px solid white" : "none",
                  outlineOffset: "2px",
                }}
                title={`Size ${s}`}
              />
            ))}
            <Sep />
            <button
              onClick={() =>
                setStrokes((prev) => {
                  const onCurrent = prev.filter((s) => s.slide === idx);
                  if (onCurrent.length === 0) return prev;
                  const lastIdx = prev.lastIndexOf(onCurrent[onCurrent.length - 1]);
                  return [...prev.slice(0, lastIdx), ...prev.slice(lastIdx + 1)];
                })
              }
              className="whitespace-nowrap rounded-md border border-white/15 px-2 py-0.5 text-[10px] font-semibold text-white/60 hover:bg-white/10 hover:text-white"
            >
              ↩ Undo
            </button>
            <button
              onClick={() => setStrokes((s) => s.filter((x) => x.slide !== idx))}
              className="whitespace-nowrap rounded-md border border-red-500/35 px-2 py-0.5 text-[10px] font-semibold text-red-300 hover:bg-red-600/25 hover:text-white"
            >
              Clear
            </button>
          </div>
        )}

        {/* Manage slides overlay */}
        {manageOpen && canEdit && (
          <div className="absolute inset-0 z-[18] overflow-y-auto bg-black/95 p-6 text-white">
            <button
              onClick={() => setManageOpen(false)}
              className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-lg border border-white/15 bg-white/10 text-white/70 hover:bg-white/20 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
            <ManageSlides
              slides={slides}
              onAdd={addFiles}
              onRemove={removeSlide}
              uploading={uploading}
              uploadStatus={uploadStatus}
              uploadError={uploadError}
              activeIdx={idx}
              onPickActive={setIdx}
            />
          </div>
        )}
      </div>

      {/* Slide nav */}
      <div className="flex flex-shrink-0 items-center gap-2 bg-black/50 px-3 py-1.5 backdrop-blur">
        <NavBtn disabled={!canPrev} onClick={() => setIdx((i) => i - 1)}>
          <ChevronLeft className="h-3.5 w-3.5" />
        </NavBtn>
        <div className="flex flex-1 items-center justify-center gap-1.5">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => canEdit && setIdx(i)}
              className="h-1 rounded transition-all"
              style={{
                width: i === idx ? 28 : 20,
                background: i === idx ? "white" : "rgba(255,255,255,.2)",
                cursor: canEdit ? "pointer" : "default",
              }}
            />
          ))}
        </div>
        <NavBtn disabled={!canNext} onClick={() => setIdx((i) => i + 1)}>
          <ChevronRight className="h-3.5 w-3.5" />
        </NavBtn>
        <span className="ml-1 min-w-[36px] text-right font-mono text-[10px] font-semibold text-white/40">
          {idx + 1} / {slides.length}
        </span>
        {canEdit && (
          <button
            onClick={() => setPenOn((v) => !v)}
            className={`ml-1 flex h-7 w-7 items-center justify-center rounded-lg border text-[14px] transition-colors ${
              penOn
                ? "border-yellow-300/50 bg-yellow-400/25 text-yellow-200"
                : "border-white/15 bg-white/10 text-white/60 hover:bg-white/20 hover:text-white"
            }`}
            title="Pen tool (P)"
          >
            <Pen className="h-3.5 w-3.5" />
          </button>
        )}
        {canEdit && (
          <button
            onClick={() => setManageOpen(true)}
            className="ml-1 flex h-7 w-7 items-center justify-center rounded-lg border border-white/15 bg-white/10 text-white/60 hover:bg-white/20 hover:text-white"
            title="Manage slides"
          >
            <Settings className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          onClick={onClose}
          className="ml-1 flex h-7 w-7 items-center justify-center rounded-lg border border-red-500/35 bg-red-600/25 text-red-300 hover:bg-red-600/45 hover:text-white"
          title="Close slides"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

/* ─── Source picker (empty state) ─── */

function SlideSourcePicker({
  onUpload,
  uploading,
  uploadStatus,
  uploadError,
}: {
  onUpload: (files: FileList | File[]) => void;
  uploading: boolean;
  uploadStatus: string | null;
  uploadError: string | null;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const openPicker = () => inputRef.current?.click();

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 p-8 text-white">
      <div className="text-center">
        <p className="text-[14px] font-semibold">Upload slides to present</p>
        <p className="mt-1 text-[11px] text-white/50">
          Saved for this class session — students will see them live
        </p>
      </div>

      <div className="flex w-full max-w-[560px] gap-3">
        {/* Upload from computer */}
        <div
          onClick={openPicker}
          onDragOver={(e) => {
            e.preventDefault();
            if (!dragOver) setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (e.dataTransfer.files?.length) onUpload(e.dataTransfer.files);
          }}
          className={`flex flex-1 cursor-pointer flex-col items-center gap-2 rounded-[14px] border-[2px] border-dashed px-6 py-6 text-center transition-colors ${
            dragOver
              ? "border-blue-400 bg-blue-400/10"
              : "border-white/25 bg-white/5 hover:border-white/50 hover:bg-white/10"
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/*,application/pdf"
            multiple
            className="hidden"
            onChange={(e) => e.target.files && onUpload(e.target.files)}
          />
          {uploading ? (
            <Loader2 className="h-7 w-7 animate-spin text-white/70" />
          ) : (
            <Upload className="h-7 w-7 text-white/70" />
          )}
          <div>
            <p className="text-[13px] font-semibold">
              {uploading ? uploadStatus ?? "Loading…" : "Upload from computer"}
            </p>
            <p className="mt-0.5 text-[10px] text-white/50">
              PDF or images — drag &amp; drop or click
            </p>
          </div>
        </div>
      </div>

      {uploadError && (
        <p className="max-w-[500px] rounded-md bg-red-500/20 px-3 py-1.5 text-[11px] text-red-200">
          {uploadError}
        </p>
      )}
      <p className="max-w-[500px] text-center text-[10px] text-white/35">
        For PowerPoint / Keynote decks, export as PDF first — we&apos;ll split the
        pages automatically.
      </p>
    </div>
  );
}

/* ─── Manage slides overlay ─── */

function ManageSlides({
  slides,
  onAdd,
  onRemove,
  uploading,
  uploadStatus,
  uploadError,
  activeIdx,
  onPickActive,
}: {
  slides: ServerSlide[];
  onAdd: (files: FileList | File[]) => void;
  onRemove: (id: string) => void;
  uploading: boolean;
  uploadStatus: string | null;
  uploadError: string | null;
  activeIdx: number;
  onPickActive: (idx: number) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  return (
    <div className="mx-auto max-w-[800px]">
      <div className="mb-4 flex items-center gap-2">
        <p className="text-[13px] font-semibold">
          {slides.length} slide{slides.length === 1 ? "" : "s"} loaded
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,application/pdf"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && onAdd(e.target.files)}
        />
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="ml-auto flex items-center gap-1 rounded-lg border border-white/15 bg-white/10 px-2.5 py-1 text-[10px] font-medium text-white/80 hover:bg-white/20 disabled:opacity-50"
        >
          {uploading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Plus className="h-3 w-3" />
          )}
          Add more
        </button>
      </div>

      {uploadStatus && (
        <p className="mb-3 text-[11px] text-white/60">{uploadStatus}</p>
      )}
      {uploadError && (
        <p className="mb-3 rounded-md bg-red-500/20 px-3 py-1.5 text-[11px] text-red-200">
          {uploadError}
        </p>
      )}

      <div className="grid grid-cols-4 gap-2">
        {slides.map((s, i) => (
          <div
            key={s.id}
            className={`group relative aspect-video overflow-hidden rounded-md border bg-white/5 ${
              i === activeIdx ? "border-blue-400" : "border-white/10"
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={s.url}
              alt={s.filename}
              className="h-full w-full object-cover"
              onClick={() => onPickActive(i)}
            />
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove(s.id);
              }}
              className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-md bg-red-600/80 text-white opacity-0 transition-opacity hover:bg-red-600 group-hover:opacity-100"
              title="Remove slide"
            >
              <Trash2 className="h-3 w-3" />
            </button>
            <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1 text-[9px] font-semibold text-white">
              {i + 1}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Helpers ─── */

function NavBtn({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/10 text-white/70 transition-colors hover:bg-white/20 hover:text-white disabled:opacity-25"
    >
      {children}
    </button>
  );
}

function ToolBtn({
  children,
  on,
  onClick,
  title,
}: {
  children: React.ReactNode;
  on: boolean;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`flex h-[30px] w-[30px] items-center justify-center rounded-full border-[1.5px] text-[14px] transition-colors ${
        on
          ? "border-white/35 bg-white/[.18]"
          : "border-transparent hover:bg-white/[.12]"
      }`}
    >
      {children}
    </button>
  );
}

function Sep() {
  return <div className="mx-0.5 h-[18px] w-px bg-white/[.12]" />;
}

/** Render each page of a PDF to a PNG Blob. Runs in-browser via pdfjs. */
async function pdfToImageBlobs(file: File): Promise<Blob[]> {
  const pdfjs = await import("pdfjs-dist");
  try {
    // @ts-expect-error — optional worker entry
    const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc = worker?.default ?? worker;
  } catch {
    pdfjs.GlobalWorkerOptions.workerSrc = "";
  }

  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const out: Blob[] = [];
  const renderScale = 2;

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: renderScale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas context unavailable");
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;
    const blob: Blob = await new Promise((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
        "image/png",
      ),
    );
    out.push(blob);
  }
  return out;
}
