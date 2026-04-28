"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";

type Tool = "pen" | "marker" | "eraser";
const COLORS = ["#FACC15", "#F87171", "#4ADE80", "#60A5FA", "#E879F9", "#FFFFFF"];
const SIZES = [3, 6, 12];

type Stroke = { tool: Tool; color: string; size: number; pts: { x: number; y: number }[] };

/** Freeze-and-draw overlay button + canvas toolbar.
 *  Wraps the video stage as children. When frozen, a canvas layer
 *  appears for drawing annotations on top. */
export function FreezeAnnotate({ children }: { children: React.ReactNode }) {
  const [frozen, setFrozen] = useState(false);
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState(COLORS[0]);
  const [size, setSize] = useState(SIZES[0]);
  const [strokes, setStrokes] = useState<Stroke[]>([]);

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef<{ active: boolean; stroke: Stroke | null }>({
    active: false,
    stroke: null,
  });

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
  }, [frozen, strokes]);

  useEffect(() => {
    if (!frozen) setStrokes([]);
  }, [frozen]);

  const redraw = () => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    for (const s of strokes) drawStroke(ctx, s);
  };

  const drawStroke = (ctx: CanvasRenderingContext2D, s: Stroke) => {
    if (s.pts.length < 2) return;
    ctx.strokeStyle = s.color;
    ctx.lineWidth = s.size;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.globalAlpha = s.tool === "marker" ? 0.45 : 1;
    ctx.globalCompositeOperation = s.tool === "eraser" ? "destination-out" : "source-over";
    ctx.beginPath();
    ctx.moveTo(s.pts[0].x, s.pts[0].y);
    for (let i = 1; i < s.pts.length; i++) ctx.lineTo(s.pts[i].x, s.pts[i].y);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  };

  const startDraw = (x: number, y: number) => {
    const stroke: Stroke = {
      tool,
      color,
      size: tool === "eraser" ? size * 3 : size,
      pts: [{ x, y }],
    };
    drawing.current = { active: true, stroke };
  };

  const moveDraw = (x: number, y: number) => {
    const d = drawing.current;
    if (!d.active || !d.stroke) return;
    d.stroke.pts.push({ x, y });
    const c = canvasRef.current;
    const ctx = c?.getContext("2d");
    if (ctx) drawStroke(ctx, d.stroke);
  };

  const endDraw = () => {
    const d = drawing.current;
    if (!d.active || !d.stroke) return;
    setStrokes((s) => [...s, d.stroke!]);
    drawing.current = { active: false, stroke: null };
  };

  const undo = () => setStrokes((s) => s.slice(0, -1));
  const clear = () => setStrokes([]);

  return (
    <div ref={wrapRef} className="relative h-full w-full overflow-hidden">
      {children}

      {/* Freeze toggle */}
      <button
        onClick={() => setFrozen((v) => !v)}
        className={`absolute right-3 top-3 z-[20] flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10.5px] font-medium backdrop-blur transition-colors ${
          frozen
            ? "border-green-400/40 bg-green-500/20 text-green-200 hover:bg-green-500/30"
            : "border-white/15 bg-black/45 text-white/80 hover:bg-black/70 hover:text-white"
        }`}
        title="Pause & annotate (F)"
      >
        {frozen ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
        {frozen ? "Resume" : "Freeze & Draw"}
      </button>

      {/* Frozen badge */}
      {frozen && (
        <div
          className="absolute left-3 top-3 z-[20] flex items-center gap-1.5 rounded-full border border-amber-400/40 px-2.5 py-1 text-[10px] font-semibold text-amber-200 backdrop-blur"
          style={{ background: "rgba(15,14,12,.7)" }}
        >
          <span className="h-1.5 w-1.5 animate-[blink_1.4s_infinite] rounded-full bg-amber-300" />
          ⏸ Frozen
        </div>
      )}

      {/* Annotation canvas */}
      <canvas
        ref={canvasRef}
        onPointerDown={(e) => {
          if (!frozen) return;
          const r = (e.target as HTMLCanvasElement).getBoundingClientRect();
          startDraw(e.clientX - r.left, e.clientY - r.top);
        }}
        onPointerMove={(e) => {
          if (!frozen || !drawing.current.active) return;
          const r = (e.target as HTMLCanvasElement).getBoundingClientRect();
          moveDraw(e.clientX - r.left, e.clientY - r.top);
        }}
        onPointerUp={endDraw}
        onPointerLeave={endDraw}
        className="absolute inset-0 z-[15]"
        style={{
          display: frozen ? "block" : "none",
          cursor: frozen ? "crosshair" : "default",
          touchAction: "none",
        }}
      />

      {/* Draw toolbar */}
      {frozen && (
        <div
          className="absolute bottom-3 left-1/2 z-[16] flex -translate-x-1/2 items-center gap-1 rounded-[30px] border border-white/10 px-2 py-1.5 backdrop-blur"
          style={{ background: "rgba(15,14,12,.85)" }}
        >
          <ToolBtn on={tool === "pen"} onClick={() => setTool("pen")} title="Pen">
            ✏️
          </ToolBtn>
          <ToolBtn on={tool === "marker"} onClick={() => setTool("marker")} title="Marker">
            🖊
          </ToolBtn>
          <ToolBtn on={tool === "eraser"} onClick={() => setTool("eraser")} title="Eraser">
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
              className="flex-shrink-0 rounded-full bg-white hover:opacity-70"
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
            onClick={undo}
            className="whitespace-nowrap rounded-md border border-white/15 px-2 py-0.5 text-[10px] font-semibold text-white/60 hover:bg-white/10 hover:text-white"
          >
            ↩ Undo
          </button>
          <button
            onClick={clear}
            className="whitespace-nowrap rounded-md border border-red-500/35 px-2 py-0.5 text-[10px] font-semibold text-red-300 hover:bg-red-600/25 hover:text-white"
          >
            Clear
          </button>
        </div>
      )}
    </div>
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
        on ? "border-white/35 bg-white/[.18]" : "border-transparent hover:bg-white/[.12]"
      }`}
    >
      {children}
    </button>
  );
}

function Sep() {
  return <div className="mx-0.5 h-[18px] w-px bg-white/[.12]" />;
}
