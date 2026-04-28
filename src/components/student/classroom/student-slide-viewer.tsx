"use client";

import { useEffect, useRef, useState } from "react";
import { usePubSub } from "@videosdk.live/react-sdk";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import api from "@/lib/api/client";

type Stroke = {
  tool: "pen" | "marker" | "eraser";
  color: string;
  size: number;
  pts: { x: number; y: number }[];
  slide: number;
};

type ServerSlide = {
  id: string;
  filename: string;
  url: string;
  idx: number;
};

/** Follow-only slide view. Fetches slide images from /api/meetings/[id]/slides
 *  (Firebase Storage-backed) and replays teacher's pen strokes from SLIDE_PEN
 *  on top. Current slide index is driven by the SLIDE pubsub. */
export function StudentSlideViewer({
  meetingId,
  onClose,
}: {
  meetingId: string;
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const slidesQ = useQuery<ServerSlide[]>({
    queryKey: ["meeting-slides", meetingId],
    queryFn: () =>
      api.get(`/meetings/${meetingId}/slides`) as unknown as Promise<ServerSlide[]>,
    enabled: !!meetingId,
    refetchInterval: 15_000,
  });

  const slides = slidesQ.data ?? [];
  const current = slides[idx];

  const { messages: slideMsgs } = usePubSub("SLIDE");
  const { messages: strokeMsgs } = usePubSub("SLIDE_PEN");

  useEffect(() => {
    const last = slideMsgs[slideMsgs.length - 1];
    if (!last) return;
    const n = Number(last.message);
    if (!Number.isNaN(n)) setIdx(n);
  }, [slideMsgs.length]);

  useEffect(() => {
    const next: Stroke[] = [];
    for (const m of strokeMsgs) {
      try {
        const raw = m.message as unknown as string;
        const parsed = JSON.parse(raw) as Stroke | { kind: "clear"; slide: number };
        if ("kind" in parsed && parsed.kind === "clear") {
          for (let i = next.length - 1; i >= 0; i--)
            if (next[i].slide === parsed.slide) next.splice(i, 1);
          continue;
        }
        next.push(parsed as Stroke);
      } catch {}
    }
    setStrokes(next);
  }, [strokeMsgs.length]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const rect = wrap.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);
    for (const s of strokes) {
      if (s.slide !== idx) continue;
      if (s.pts.length < 2) continue;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = s.size;
      ctx.strokeStyle = s.color;
      ctx.globalAlpha = s.tool === "marker" ? 0.45 : 1;
      ctx.globalCompositeOperation = s.tool === "eraser" ? "destination-out" : "source-over";
      ctx.beginPath();
      ctx.moveTo(s.pts[0].x * rect.width, s.pts[0].y * rect.height);
      for (let i = 1; i < s.pts.length; i++) {
        ctx.lineTo(s.pts[i].x * rect.width, s.pts[i].y * rect.height);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }, [strokes, idx, current?.id]);

  return (
    <div className="absolute inset-0 z-[40] flex flex-col bg-black/95 text-white">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2 text-[12px]">
        <span className="font-semibold">
          Following teacher · Slide {slides.length > 0 ? idx + 1 : 0} of {slides.length}
        </span>
        <button
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-md text-white/70 hover:bg-white/10"
          aria-label="Close slide view"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div ref={wrapRef} className="relative flex-1">
        {current ? (
          <div className="absolute inset-0 flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={current.url}
              alt={current.filename}
              className="max-h-full max-w-full object-contain"
              draggable={false}
            />
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-white/50">
            <div className="rounded-xl border border-white/20 bg-white/5 px-8 py-12 text-center backdrop-blur-sm">
              <p className="text-[14px] font-semibold">
                {slidesQ.isLoading ? "Loading slides…" : "No slides yet"}
              </p>
              <p className="mt-1 text-[11px] text-white/50">
                {slidesQ.isLoading
                  ? "Fetching what your teacher has shared."
                  : "Your teacher hasn't uploaded slides for this class."}
              </p>
            </div>
          </div>
        )}
        <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
      </div>
    </div>
  );
}
