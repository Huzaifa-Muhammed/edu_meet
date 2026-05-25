"use client";

import { useEffect, useRef, useState } from "react";
import { usePubSub } from "@videosdk.live/react-sdk";
import api from "@/lib/api/client";

const DEFAULT_GRACE_MS = 8_000;

export type AwayEvent = { durationMs: number; at: number };

/** Watches `document.visibilityState` while a student is in a live class.
 *  When the tab is hidden longer than `graceMs`, marks the student "away":
 *  publishes `STUDENT_AWAY` for the teacher's UI, persists to Firestore via
 *  the attendance/event API (which also bumps a per-(meeting,uid) aggregate),
 *  and surfaces an event so the caller can render a soft warning when they
 *  return. On return, publishes `STUDENT_RETURNED` and posts an `attentive`
 *  event with the elapsed away duration. `pagehide` is also handled so a
 *  student who closes the tab while away still gets the event recorded. */
export function useAttentionTracker({
  enabled,
  meetingId,
  uid,
  name,
  graceMs = DEFAULT_GRACE_MS,
}: {
  enabled: boolean;
  meetingId: string;
  uid?: string;
  name?: string;
  graceMs?: number;
}) {
  const { publish: publishAway } = usePubSub("STUDENT_AWAY");
  const { publish: publishReturned } = usePubSub("STUDENT_RETURNED");

  const [awayEvent, setAwayEvent] = useState<AwayEvent | null>(null);
  const hiddenAtRef = useRef<number | null>(null);
  const markedAwayRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled || !uid || !meetingId) return;

    const clearTimer = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        hiddenAtRef.current = Date.now();
        clearTimer();
        timerRef.current = setTimeout(() => {
          if (!document.hidden) return;
          markedAwayRef.current = true;
          publishAway(
            JSON.stringify({
              uid,
              name: name ?? "Student",
              at: Date.now(),
            }),
            { persist: false },
          );
          api
            .post(`/meetings/${meetingId}/attendance/event`, { type: "away" })
            .catch(() => {
              /* network blip — pubsub already updated teacher UI */
            });
        }, graceMs);
      } else {
        clearTimer();
        const startedAt = hiddenAtRef.current;
        hiddenAtRef.current = null;
        if (markedAwayRef.current && startedAt) {
          const durationMs = Date.now() - startedAt;
          markedAwayRef.current = false;
          publishReturned(
            JSON.stringify({
              uid,
              name: name ?? "Student",
              durationMs,
              at: Date.now(),
            }),
            { persist: false },
          );
          api
            .post(`/meetings/${meetingId}/attendance/event`, {
              type: "attentive",
              durationMs,
            })
            .catch(() => {
              /* non-fatal */
            });
          setAwayEvent({ durationMs, at: Date.now() });
        }
      }
    };

    // If the user closes the tab while away, fire-and-forget a beacon so the
    // away duration still lands in Firestore. Beacon survives unload where
    // a normal fetch would be cancelled.
    const onPageHide = () => {
      if (!markedAwayRef.current || !hiddenAtRef.current) return;
      const durationMs = Date.now() - hiddenAtRef.current;
      try {
        navigator.sendBeacon?.(
          `/api/meetings/${meetingId}/attendance/event`,
          new Blob(
            [JSON.stringify({ type: "attentive", durationMs })],
            { type: "application/json" },
          ),
        );
      } catch {
        // best-effort
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onPageHide);
      clearTimer();
    };
    // publish fns from videosdk are stable per pubsub topic, but we depend on
    // primitives only to avoid re-binding the listener on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, meetingId, uid, name, graceMs]);

  return {
    awayEvent,
    dismissAwayEvent: () => setAwayEvent(null),
  };
}
