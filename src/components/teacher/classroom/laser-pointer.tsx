"use client";

import { useEffect, useRef, useState } from "react";
import { usePubSub } from "@videosdk.live/react-sdk";

/** Broadcasts the teacher's mouse position over the wrapped area as a laser
 *  pointer dot. Receivers render the latest position, fading after 700ms. */
export function LaserPointer({
  active,
  canEdit,
  children,
}: {
  active: boolean;
  canEdit: boolean;
  children: React.ReactNode;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number; ts: number } | null>(null);
  const { publish, messages } = usePubSub("POINTER");

  // Rate-limit outgoing publishes (~20Hz)
  const lastPub = useRef(0);

  // Non-editors: follow incoming pointer messages
  useEffect(() => {
    if (canEdit) return;
    const last = messages[messages.length - 1];
    if (!last) return;
    try {
      const p = JSON.parse(last.message as unknown as string) as { x: number; y: number };
      setPos({ x: p.x, y: p.y, ts: Date.now() });
    } catch {
      // ignore
    }
  }, [messages.length, canEdit]);

  // Teacher: track pointer inside wrap and publish fractional coords
  useEffect(() => {
    if (!active || !canEdit) {
      setPos(null);
      return;
    }
    const onMove = (e: MouseEvent) => {
      const w = wrapRef.current;
      if (!w) return;
      const r = w.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      if (x < 0 || y < 0 || x > r.width || y > r.height) {
        setPos(null);
        return;
      }
      setPos({ x: x / r.width, y: y / r.height, ts: Date.now() });
      const now = Date.now();
      if (now - lastPub.current > 50) {
        lastPub.current = now;
        publish(
          JSON.stringify({ x: x / r.width, y: y / r.height }),
          { persist: false },
        );
      }
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [active, canEdit, publish]);

  // Fade pointer after 700ms of inactivity
  const [fade, setFade] = useState(0);
  useEffect(() => {
    if (!pos) {
      setFade(0);
      return;
    }
    setFade(1);
    const id = setInterval(() => {
      if (!pos) return;
      const age = Date.now() - pos.ts;
      setFade(age > 700 ? 0 : Math.max(0, 1 - age / 700));
    }, 100);
    return () => clearInterval(id);
  }, [pos]);

  const w = wrapRef.current;
  const rect = w?.getBoundingClientRect();
  const visible = !!pos && fade > 0 && !!rect;

  return (
    <div ref={wrapRef} className="relative h-full w-full">
      {children}
      {visible && (
        <div
          className="pointer-events-none absolute z-[25] h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            left: `${pos!.x * 100}%`,
            top: `${pos!.y * 100}%`,
            background:
              "radial-gradient(circle, rgba(255,50,50,.95) 0%, rgba(255,0,0,.55) 40%, rgba(255,0,0,0) 70%)",
            boxShadow: "0 0 12px 4px rgba(255,40,40,.55)",
            opacity: fade,
          }}
        />
      )}
    </div>
  );
}
