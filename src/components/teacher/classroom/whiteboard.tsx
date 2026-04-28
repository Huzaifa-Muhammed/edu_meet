"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { usePubSub } from "@videosdk.live/react-sdk";
import {
  Pencil,
  Eraser,
  Highlighter,
  Undo2,
  Redo2,
  Trash2,
  X,
  Square,
  Circle,
  Minus,
  ArrowUpRight,
  Type,
  MousePointer2,
  Download,
  Grid3x3,
  Dot,
  PaintBucket,
  Palette,
  Paintbrush,
} from "lucide-react";

type Point = { x: number; y: number };

type FreeStroke = {
  id: string;
  mode: "pen" | "marker" | "eraser";
  points: Point[];
  color: string;
  size: number;
};
type ShapeStroke = {
  id: string;
  mode: "rect" | "circle" | "line" | "arrow";
  start: Point;
  end: Point;
  color: string;
  size: number;
  fill: boolean;
};
type TextStroke = {
  id: string;
  mode: "text";
  anchor: Point;
  text: string;
  color: string;
  fontSize: number;
};
type Stroke = FreeStroke | ShapeStroke | TextStroke;

type Tool =
  | "pen"
  | "marker"
  | "eraser"
  | "line"
  | "arrow"
  | "rect"
  | "circle"
  | "text"
  | "laser";

type Background = "blank" | "grid" | "dots";

const COLORS = [
  "#1A1916",
  "#FFFFFF",
  "#DC2626",
  "#EA580C",
  "#FACC15",
  "#16A34A",
  "#0EA5E9",
  "#2563EB",
  "#7C3AED",
  "#DB2777",
  "#64748B",
  "#FB7185",
];
const SIZES = [3, 6, 12];

/** Board surface presets. Dark bgs flip the grid/dot color automatically. */
const BOARD_BGS: { name: string; color: string }[] = [
  { name: "White", color: "#FFFFFF" },
  { name: "Cream", color: "#FEF3C7" },
  { name: "Soft blue", color: "#DBEAFE" },
  { name: "Mint", color: "#D1FAE5" },
  { name: "Slate", color: "#1E293B" },
  { name: "Navy", color: "#0B1F4D" },
  { name: "Chalk green", color: "#0B3D2E" },
  { name: "Black", color: "#000000" },
];

/** Perceptual-luminance check — true if the background is dark (→ use light grid). */
function isDarkColor(hex: string): boolean {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return false;
  const r = parseInt(m[1], 16);
  const g = parseInt(m[2], 16);
  const b = parseInt(m[3], 16);
  return r * 0.299 + g * 0.587 + b * 0.114 < 128;
}

type PubsubPayload =
  | { kind: "stroke"; stroke: Stroke }
  | { kind: "clear" }
  | { kind: "delete"; id: string };

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : String(Math.random()).slice(2);

/**
 * Collaborative whiteboard. Strokes, shapes, and text are broadcast via
 * VideoSDK pubsub (persisted), so late-joiners replay the full board.
 * Laser pointer is local-only and ephemeral (fades in ~1s).
 */
export function Whiteboard({
  active,
  onClose,
  canEdit,
}: {
  active: boolean;
  onClose: () => void;
  canEdit: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const laserCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const strokesRef = useRef<Stroke[]>([]);
  const redoRef = useRef<Stroke[]>([]);
  const drawingRef = useRef(false);
  const draftRef = useRef<Stroke | null>(null);
  const laserTrailRef = useRef<Array<{ p: Point; t: number }>>([]);

  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState(COLORS[0]);
  const [size, setSize] = useState(SIZES[0]);
  const [fill, setFill] = useState(false);
  const [background, setBackground] = useState<Background>("blank");
  const [boardBg, setBoardBg] = useState<string>(BOARD_BGS[0].color);
  const [textInput, setTextInput] = useState<{
    anchor: Point;
    value: string;
  } | null>(null);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [boardBgOpen, setBoardBgOpen] = useState(false);

  const boardIsDark = isDarkColor(boardBg);

  const { publish, messages } = usePubSub("WHITEBOARD");

  // Apply remote stroke messages (and teacher's own when replayed).
  useEffect(() => {
    if (!canEdit) {
      // Student: full replay
      strokesRef.current = [];
      for (const m of messages) {
        applyPayload(m.message, strokesRef.current);
      }
      redraw();
    } else {
      const latest = messages[messages.length - 1];
      if (!latest) return;
      applyPayload(latest.message, strokesRef.current);
      redraw();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    const laser = laserCanvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !laser) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    for (const c of [canvas, laser]) {
      c.width = rect.width * dpr;
      c.height = rect.height * dpr;
      c.style.width = `${rect.width}px`;
      c.style.height = `${rect.height}px`;
      c.getContext("2d")?.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    redraw();
  }, []);

  useEffect(() => {
    if (!active) return;
    resize();
    const ro = new ResizeObserver(resize);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [active, resize]);

  // Laser pointer fade loop
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    const tick = () => {
      const laser = laserCanvasRef.current;
      const rect = laser?.getBoundingClientRect();
      if (laser && rect) {
        const ctx = laser.getContext("2d");
        if (ctx) {
          ctx.clearRect(0, 0, rect.width, rect.height);
          const now = performance.now();
          laserTrailRef.current = laserTrailRef.current.filter(
            (t) => now - t.t < 1000,
          );
          for (const pt of laserTrailRef.current) {
            const age = (now - pt.t) / 1000;
            const alpha = 1 - age;
            ctx.beginPath();
            ctx.fillStyle = `rgba(255,59,48,${alpha * 0.8})`;
            ctx.arc(
              pt.p.x * rect.width,
              pt.p.y * rect.height,
              10 - age * 8,
              0,
              Math.PI * 2,
            );
            ctx.fill();
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active]);

  function applyPayload(raw: string, target: Stroke[]) {
    try {
      const payload = JSON.parse(raw) as PubsubPayload;
      if (payload.kind === "stroke") target.push(payload.stroke);
      else if (payload.kind === "clear") target.length = 0;
      else if (payload.kind === "delete") {
        const i = target.findIndex((s) => s.id === payload.id);
        if (i >= 0) target.splice(i, 1);
      }
    } catch {}
  }

  function drawBackground(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
  ) {
    ctx.fillStyle = boardBg;
    ctx.fillRect(0, 0, w, h);
    if (background === "blank") return;
    // Adapt grid/dot contrast to the board surface
    const lineColor = boardIsDark ? "rgba(255,255,255,0.12)" : "#E6E3DB";
    const dotColor = boardIsDark ? "rgba(255,255,255,0.22)" : "#D1CDC1";
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 1;
    if (background === "grid") {
      const step = 28;
      ctx.beginPath();
      for (let x = step; x < w; x += step) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
      }
      for (let y = step; y < h; y += step) {
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
      }
      ctx.stroke();
    } else if (background === "dots") {
      const step = 24;
      ctx.fillStyle = dotColor;
      for (let x = step; x < w; x += step) {
        for (let y = step; y < h; y += step) {
          ctx.beginPath();
          ctx.arc(x, y, 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  function redraw() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    drawBackground(ctx, rect.width, rect.height);
    for (const s of strokesRef.current) drawStroke(ctx, s, rect);
    if (draftRef.current) drawStroke(ctx, draftRef.current, rect);
  }

  function drawStroke(
    ctx: CanvasRenderingContext2D,
    s: Stroke,
    rect: { width: number; height: number },
  ) {
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (s.mode === "pen" || s.mode === "marker" || s.mode === "eraser") {
      if (s.points.length === 0) {
        ctx.restore();
        return;
      }
      if (s.mode === "eraser") {
        ctx.globalCompositeOperation = "destination-out";
        ctx.strokeStyle = "rgba(0,0,0,1)";
        ctx.lineWidth = s.size * 3;
      } else if (s.mode === "marker") {
        ctx.globalAlpha = 0.45;
        ctx.strokeStyle = s.color;
        ctx.lineWidth = s.size * 2;
      } else {
        ctx.strokeStyle = s.color;
        ctx.lineWidth = s.size;
      }
      ctx.beginPath();
      s.points.forEach((p, i) => {
        const x = p.x * rect.width;
        const y = p.y * rect.height;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    } else if (s.mode === "rect") {
      const x1 = s.start.x * rect.width;
      const y1 = s.start.y * rect.height;
      const x2 = s.end.x * rect.width;
      const y2 = s.end.y * rect.height;
      ctx.lineWidth = s.size;
      if (s.fill) {
        ctx.fillStyle = s.color;
        ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
      } else {
        ctx.strokeStyle = s.color;
        ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
      }
    } else if (s.mode === "circle") {
      const x1 = s.start.x * rect.width;
      const y1 = s.start.y * rect.height;
      const x2 = s.end.x * rect.width;
      const y2 = s.end.y * rect.height;
      const cx = (x1 + x2) / 2;
      const cy = (y1 + y2) / 2;
      const rx = Math.abs(x2 - x1) / 2;
      const ry = Math.abs(y2 - y1) / 2;
      ctx.lineWidth = s.size;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      if (s.fill) {
        ctx.fillStyle = s.color;
        ctx.fill();
      } else {
        ctx.strokeStyle = s.color;
        ctx.stroke();
      }
    } else if (s.mode === "line") {
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.size;
      ctx.beginPath();
      ctx.moveTo(s.start.x * rect.width, s.start.y * rect.height);
      ctx.lineTo(s.end.x * rect.width, s.end.y * rect.height);
      ctx.stroke();
    } else if (s.mode === "arrow") {
      const x1 = s.start.x * rect.width;
      const y1 = s.start.y * rect.height;
      const x2 = s.end.x * rect.width;
      const y2 = s.end.y * rect.height;
      const dx = x2 - x1;
      const dy = y2 - y1;
      const angle = Math.atan2(dy, dx);
      const head = Math.max(12, s.size * 3);
      ctx.strokeStyle = s.color;
      ctx.fillStyle = s.color;
      ctx.lineWidth = s.size;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(
        x2 - head * Math.cos(angle - Math.PI / 6),
        y2 - head * Math.sin(angle - Math.PI / 6),
      );
      ctx.lineTo(
        x2 - head * Math.cos(angle + Math.PI / 6),
        y2 - head * Math.sin(angle + Math.PI / 6),
      );
      ctx.closePath();
      ctx.fill();
    } else if (s.mode === "text") {
      ctx.fillStyle = s.color;
      ctx.font = `${s.fontSize}px "DM Sans", sans-serif`;
      ctx.textBaseline = "top";
      const lines = s.text.split("\n");
      lines.forEach((line, i) => {
        ctx.fillText(
          line,
          s.anchor.x * rect.width,
          s.anchor.y * rect.height + i * s.fontSize * 1.25,
        );
      });
    }

    ctx.restore();
  }

  function getPointer(e: React.PointerEvent) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    };
  }

  function onPointerDown(e: React.PointerEvent) {
    if (!canEdit) return;
    e.preventDefault();
    const p = getPointer(e);

    if (tool === "laser") {
      laserTrailRef.current.push({ p, t: performance.now() });
      return;
    }
    if (tool === "text") {
      setTextInput({ anchor: p, value: "" });
      return;
    }

    (e.target as Element).setPointerCapture(e.pointerId);
    drawingRef.current = true;

    if (tool === "pen" || tool === "marker" || tool === "eraser") {
      draftRef.current = {
        id: uid(),
        mode: tool,
        points: [p],
        color,
        size,
      };
    } else if (tool === "rect" || tool === "circle" || tool === "line" || tool === "arrow") {
      draftRef.current = {
        id: uid(),
        mode: tool,
        start: p,
        end: p,
        color,
        size,
        fill,
      };
    }
    redraw();
  }

  function onPointerMove(e: React.PointerEvent) {
    const p = getPointer(e);
    if (tool === "laser") {
      if ((e.buttons & 1) === 1 || laserTrailRef.current.length > 0) {
        laserTrailRef.current.push({ p, t: performance.now() });
      }
      return;
    }
    if (!drawingRef.current || !draftRef.current) return;
    const d = draftRef.current;
    if (d.mode === "pen" || d.mode === "marker" || d.mode === "eraser") {
      d.points.push(p);
    } else if (
      d.mode === "rect" ||
      d.mode === "circle" ||
      d.mode === "line" ||
      d.mode === "arrow"
    ) {
      d.end = p;
    }
    redraw();
  }

  function onPointerUp() {
    if (!drawingRef.current || !draftRef.current) return;
    drawingRef.current = false;
    const finalised = draftRef.current;
    draftRef.current = null;
    // Ignore zero-size shape clicks
    if (
      (finalised.mode === "rect" ||
        finalised.mode === "circle" ||
        finalised.mode === "line" ||
        finalised.mode === "arrow") &&
      Math.abs(finalised.end.x - finalised.start.x) < 0.003 &&
      Math.abs(finalised.end.y - finalised.start.y) < 0.003
    ) {
      redraw();
      return;
    }
    strokesRef.current.push(finalised);
    redoRef.current = []; // new action clears redo stack
    redraw();
    publish(
      JSON.stringify({ kind: "stroke", stroke: finalised } satisfies PubsubPayload),
      { persist: true },
    );
  }

  function commitText() {
    if (!textInput) return;
    const val = textInput.value.trim();
    if (val) {
      const s: TextStroke = {
        id: uid(),
        mode: "text",
        anchor: textInput.anchor,
        text: val,
        color,
        fontSize: size === 3 ? 16 : size === 6 ? 22 : 30,
      };
      strokesRef.current.push(s);
      redoRef.current = [];
      publish(
        JSON.stringify({ kind: "stroke", stroke: s } satisfies PubsubPayload),
        { persist: true },
      );
      redraw();
    }
    setTextInput(null);
  }

  function undo() {
    if (!canEdit) return;
    const popped = strokesRef.current.pop();
    if (!popped) return;
    redoRef.current.push(popped);
    redraw();
    publish(
      JSON.stringify({ kind: "delete", id: popped.id } satisfies PubsubPayload),
      { persist: true },
    );
  }

  function redo() {
    if (!canEdit) return;
    const popped = redoRef.current.pop();
    if (!popped) return;
    strokesRef.current.push(popped);
    redraw();
    publish(
      JSON.stringify({ kind: "stroke", stroke: popped } satisfies PubsubPayload),
      { persist: true },
    );
  }

  function clear() {
    if (!canEdit) return;
    strokesRef.current = [];
    redoRef.current = [];
    redraw();
    publish(JSON.stringify({ kind: "clear" } satisfies PubsubPayload), {
      persist: true,
    });
  }

  function downloadPNG() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `whiteboard-${Date.now()}.png`;
    a.click();
  }

  if (!active) return null;

  const cursor =
    tool === "laser"
      ? "cursor-none"
      : tool === "text"
        ? "cursor-text"
        : "cursor-crosshair";

  return (
    <div ref={containerRef} className="absolute inset-0 z-30 bg-white">
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 ${canEdit ? cursor + " touch-none" : "touch-none"}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />
      <canvas
        ref={laserCanvasRef}
        className="pointer-events-none absolute inset-0"
      />

      {textInput && (
        <textarea
          autoFocus
          value={textInput.value}
          onChange={(e) => setTextInput({ ...textInput, value: e.target.value })}
          onBlur={commitText}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              commitText();
            }
            if (e.key === "Escape") setTextInput(null);
          }}
          placeholder="Type…"
          style={{
            position: "absolute",
            left: `${textInput.anchor.x * 100}%`,
            top: `${textInput.anchor.y * 100}%`,
            color,
            fontSize: size === 3 ? 16 : size === 6 ? 22 : 30,
            fontFamily: "DM Sans, sans-serif",
            minWidth: 120,
            border: `1px dashed ${boardIsDark ? "#94A3B8" : "#94A3B8"}`,
            background: boardIsDark
              ? "rgba(15,23,42,0.92)"
              : "rgba(255,255,255,0.95)",
            padding: "2px 4px",
            outline: "none",
            resize: "both",
          }}
        />
      )}

      {canEdit && (
        <div className="absolute bottom-4 left-1/2 z-10 flex max-w-[calc(100%-2rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-1 rounded-2xl border border-white/10 bg-[rgba(15,14,12,0.92)] px-2 py-1.5 shadow-xl backdrop-blur">
          {/* Drawing tools */}
          <ToolBtn active={tool === "pen"} onClick={() => setTool("pen")} label="Pen">
            <Pencil className="h-3.5 w-3.5" />
          </ToolBtn>
          <ToolBtn active={tool === "marker"} onClick={() => setTool("marker")} label="Highlighter">
            <Highlighter className="h-3.5 w-3.5" />
          </ToolBtn>
          <ToolBtn active={tool === "eraser"} onClick={() => setTool("eraser")} label="Eraser">
            <Eraser className="h-3.5 w-3.5" />
          </ToolBtn>

          <Sep />

          {/* Shape tools */}
          <ToolBtn active={tool === "line"} onClick={() => setTool("line")} label="Line">
            <Minus className="h-3.5 w-3.5" />
          </ToolBtn>
          <ToolBtn active={tool === "arrow"} onClick={() => setTool("arrow")} label="Arrow">
            <ArrowUpRight className="h-3.5 w-3.5" />
          </ToolBtn>
          <ToolBtn active={tool === "rect"} onClick={() => setTool("rect")} label="Rectangle">
            <Square className="h-3.5 w-3.5" />
          </ToolBtn>
          <ToolBtn active={tool === "circle"} onClick={() => setTool("circle")} label="Ellipse">
            <Circle className="h-3.5 w-3.5" />
          </ToolBtn>
          <ToolBtn active={tool === "text"} onClick={() => setTool("text")} label="Text">
            <Type className="h-3.5 w-3.5" />
          </ToolBtn>
          <ToolBtn active={tool === "laser"} onClick={() => setTool("laser")} label="Laser pointer">
            <MousePointer2 className="h-3.5 w-3.5" />
          </ToolBtn>

          <Sep />

          {/* Fill toggle for shapes */}
          <ToolBtn
            active={fill}
            onClick={() => setFill((v) => !v)}
            label={fill ? "Fill on" : "Fill off"}
            disabled={!["rect", "circle"].includes(tool)}
          >
            <PaintBucket className="h-3.5 w-3.5" />
          </ToolBtn>

          <Sep />

          {/* Colors */}
          {COLORS.slice(0, 8).map((c) => (
            <button
              key={c}
              onClick={() => {
                setColor(c);
                if (tool === "eraser") setTool("pen");
              }}
              className={`h-5 w-5 flex-shrink-0 rounded-full border-2 transition ${
                color === c ? "scale-110 border-white" : "border-transparent"
              }`}
              style={{
                background: c,
                boxShadow: c === "#FFFFFF" ? "inset 0 0 0 1px #94a3b8" : undefined,
              }}
              aria-label={`Color ${c}`}
            />
          ))}

          {/* Custom color */}
          <div className="relative">
            <button
              onClick={() => setColorPickerOpen((v) => !v)}
              className="flex h-6 w-6 items-center justify-center rounded-full border border-white/25 bg-white/10 text-white/70 hover:bg-white/20"
              title="More colors"
            >
              <Palette className="h-3 w-3" />
            </button>
            {colorPickerOpen && (
              <div className="absolute bottom-full left-1/2 mb-2 -translate-x-1/2 rounded-lg border border-white/10 bg-[rgba(15,14,12,0.95)] p-2">
                <div className="grid grid-cols-4 gap-1">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => {
                        setColor(c);
                        setColorPickerOpen(false);
                      }}
                      className="h-5 w-5 rounded-full border border-white/20"
                      style={{ background: c }}
                    />
                  ))}
                </div>
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="mt-2 h-6 w-full cursor-pointer rounded border border-white/20 bg-transparent"
                />
              </div>
            )}
          </div>

          <Sep />

          {/* Sizes */}
          {SIZES.map((s) => (
            <button
              key={s}
              onClick={() => setSize(s)}
              className={`flex h-7 w-7 items-center justify-center rounded-full transition ${
                size === s ? "bg-white/20 outline outline-2 outline-white/70" : ""
              }`}
              aria-label={`Size ${s}`}
            >
              <span
                className="block rounded-full bg-white"
                style={{ width: s + 3, height: s + 3 }}
              />
            </button>
          ))}

          <Sep />

          {/* History */}
          <IconBtn
            onClick={undo}
            label="Undo"
            disabled={strokesRef.current.length === 0}
          >
            <Undo2 className="h-3.5 w-3.5" />
          </IconBtn>
          <IconBtn
            onClick={redo}
            label="Redo"
            disabled={redoRef.current.length === 0}
          >
            <Redo2 className="h-3.5 w-3.5" />
          </IconBtn>

          <Sep />

          {/* Background cycle */}
          <ToolBtn
            active={background !== "blank"}
            onClick={() =>
              setBackground(
                background === "blank" ? "grid" : background === "grid" ? "dots" : "blank",
              )
            }
            label={`Background: ${background}`}
          >
            {background === "grid" ? (
              <Grid3x3 className="h-3.5 w-3.5" />
            ) : background === "dots" ? (
              <Dot className="h-3.5 w-3.5" />
            ) : (
              <Square className="h-3.5 w-3.5" />
            )}
          </ToolBtn>

          {/* Board color */}
          <div className="relative">
            <button
              onClick={() => setBoardBgOpen((v) => !v)}
              title={`Board color: ${boardBg}`}
              className="flex h-7 w-7 items-center justify-center rounded-full text-white/70 transition hover:bg-white/10"
            >
              <Paintbrush className="h-3.5 w-3.5" />
            </button>
            {boardBgOpen && (
              <div className="absolute bottom-full left-1/2 mb-2 -translate-x-1/2 rounded-lg border border-white/10 bg-[rgba(15,14,12,0.95)] p-2">
                <div className="mb-1.5 text-center text-[9px] font-semibold uppercase tracking-[.4px] text-white/60">
                  Board
                </div>
                <div className="grid grid-cols-4 gap-1">
                  {BOARD_BGS.map((b) => (
                    <button
                      key={b.color}
                      onClick={() => {
                        setBoardBg(b.color);
                        // On dark bgs, auto-flip default pen color to white so
                        // the teacher isn't drawing invisible lines.
                        if (isDarkColor(b.color) && color === "#1A1916") {
                          setColor("#FFFFFF");
                        } else if (
                          !isDarkColor(b.color) &&
                          color === "#FFFFFF"
                        ) {
                          setColor("#1A1916");
                        }
                        setBoardBgOpen(false);
                      }}
                      title={b.name}
                      className={`h-6 w-6 rounded-md border transition ${
                        boardBg === b.color
                          ? "scale-105 border-white"
                          : "border-white/20"
                      }`}
                      style={{ background: b.color }}
                    />
                  ))}
                </div>
                <input
                  type="color"
                  value={boardBg}
                  onChange={(e) => setBoardBg(e.target.value)}
                  className="mt-2 h-6 w-full cursor-pointer rounded border border-white/20 bg-transparent"
                  title="Custom color"
                />
              </div>
            )}
          </div>

          <IconBtn onClick={downloadPNG} label="Download PNG">
            <Download className="h-3.5 w-3.5" />
          </IconBtn>

          <IconBtn onClick={clear} label="Clear" danger>
            <Trash2 className="h-3.5 w-3.5" />
          </IconBtn>
        </div>
      )}

      <button
        onClick={onClose}
        className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-lg bg-[rgba(15,14,12,0.8)] px-3 py-1.5 text-[11px] font-medium text-white hover:bg-black"
      >
        <X className="h-3.5 w-3.5" />
        Close whiteboard
      </button>

      {/* Background-redraw trigger */}
      <BackgroundRedraw
        background={background}
        boardBg={boardBg}
        onChange={redraw}
      />
    </div>
  );
}

function BackgroundRedraw({
  background,
  boardBg,
  onChange,
}: {
  background: Background;
  boardBg: string;
  onChange: () => void;
}) {
  useEffect(() => {
    onChange();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [background, boardBg]);
  return null;
}

function Sep() {
  return <span className="mx-0.5 h-4 w-px bg-white/15" />;
}

function ToolBtn({
  active,
  onClick,
  label,
  children,
  disabled,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={`flex h-7 w-7 items-center justify-center rounded-full transition disabled:opacity-30 ${
        active
          ? "border-[1.5px] border-white/35 bg-white/18 text-white"
          : "text-white/65 hover:bg-white/10"
      }`}
    >
      {children}
    </button>
  );
}

function IconBtn({
  onClick,
  label,
  children,
  disabled,
  danger,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={`flex h-7 w-7 items-center justify-center rounded-full transition disabled:opacity-30 ${
        danger
          ? "text-red-300 hover:bg-red-500/20"
          : "text-white/70 hover:bg-white/10"
      }`}
    >
      {children}
    </button>
  );
}
