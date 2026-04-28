"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useMeeting } from "@videosdk.live/react-sdk";

type ClassroomTheme = "glass" | "barca" | "superman";

const THEME_OPTIONS: { id: ClassroomTheme; label: string }[] = [
  { id: "glass", label: "Liquid Glass" },
  { id: "barca", label: "Blaugrana" },
  { id: "superman", label: "Superman ⚡" },
];

export function StudentClassroomTopbar({
  classroomName,
  subjectName,
  teacherName,
  startedAt,
  handRaised,
  onRaiseHand,
  onLeave,
  userInitial,
  theme = "glass",
  onChangeTheme,
}: {
  classroomName: string;
  subjectName?: string;
  teacherName: string;
  startedAt?: string | null;
  handRaised: boolean;
  onRaiseHand: () => void;
  onLeave: () => void;
  userInitial: string;
  theme?: ClassroomTheme;
  onChangeTheme?: (t: ClassroomTheme) => void;
}) {
  const { toggleMic, localMicOn, toggleWebcam, localWebcamOn } = useMeeting();
  const [elapsed, setElapsed] = useState("0s");
  const [themeOpen, setThemeOpen] = useState(false);
  const themeRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!themeOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (themeRef.current && !themeRef.current.contains(e.target as Node)) {
        setThemeOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [themeOpen]);

  const activeOpt = THEME_OPTIONS.find((o) => o.id === theme) ?? THEME_OPTIONS[0];

  useEffect(() => {
    if (!startedAt) return;
    const start = new Date(startedAt).getTime();
    const tick = () => {
      const diff = Math.max(0, Date.now() - start);
      const m = Math.floor(diff / 60_000);
      const s = Math.floor((diff / 1000) % 60);
      setElapsed(
        m > 0 ? `${m}:${String(s).padStart(2, "0")}` : `${s}s`,
      );
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [startedAt]);

  // void unused {teacherName} — kept in API for future subject-line use
  void teacherName;

  return (
    <div className="topbar">
      <div className="logo">
        <div className="logo-sq">
          <svg viewBox="0 0 14 14">
            <rect x="1" y="1" width="5" height="5" rx="1" />
            <rect x="8" y="1" width="5" height="5" rx="1" />
            <rect x="1" y="8" width="5" height="5" rx="1" />
            <rect x="8" y="8" width="5" height="5" rx="1" />
          </svg>
        </div>
        EduMeet
      </div>
      <span className="portal-badge">Student Portal</span>

      <div className="top-mid">
        <span className="lesson-lbl">{classroomName}</span>
        {subjectName && <span className="subj-badge">{subjectName}</span>}
        <div className="live-pill">
          <div className="live-dot" />
          <span className="live-lbl">Live</span>
          <span className="timer-txt">{elapsed}</span>
        </div>
      </div>

      <div className="top-right">
        <button
          className={`hand-btn${handRaised ? " on" : ""}`}
          onClick={onRaiseHand}
        >
          ✋ {handRaised ? "Hand raised" : "Raise hand"}
        </button>

        <div
          className={`mic-btn${localMicOn ? "" : " muted"}`}
          onClick={() => toggleMic?.()}
          title={localMicOn ? "Mute mic" : "Unmute"}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
            {localMicOn ? (
              <>
                <path d="M8 1a2.5 2.5 0 0 1 2.5 2.5v4A2.5 2.5 0 0 1 5.5 7.5v-4A2.5 2.5 0 0 1 8 1z" />
                <path d="M3 7a5 5 0 0 0 10 0" />
                <line x1="8" y1="12" x2="8" y2="15" />
              </>
            ) : (
              <>
                <path d="M1 1l14 14M8 1a2.5 2.5 0 0 1 2.5 2.5v1.5M5.5 5.5v2A2.5 2.5 0 0 0 10 9" />
                <path d="M3 7a5 5 0 0 0 9.5 2" />
              </>
            )}
          </svg>
        </div>

        <div
          className={`mic-btn${localWebcamOn ? "" : " muted"}`}
          onClick={() => toggleWebcam?.()}
          title={localWebcamOn ? "Turn camera off" : "Turn camera on"}
          style={{ marginLeft: 4 }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
            {localWebcamOn ? (
              <>
                <rect x="1" y="4" width="9" height="8" rx="1.5" />
                <path d="M10 7l4-2v6l-4-2z" />
              </>
            ) : (
              <>
                <path d="M1 1l14 14" />
                <rect x="1" y="4" width="9" height="8" rx="1.5" />
                <path d="M10 7l4-2v6l-4-2z" />
              </>
            )}
          </svg>
        </div>

        {onChangeTheme && (
          <div ref={themeRef} style={{ position: "relative" }}>
            <button
              type="button"
              className="theme-sw"
              onClick={() => setThemeOpen((v) => !v)}
              title="Change theme"
            >
              <span className={`theme-sw-swatch ${theme}`} />
              {activeOpt.label}
            </button>
            {themeOpen && (
              <div className="theme-sw-menu" role="menu">
                {THEME_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    className={`theme-sw-opt${opt.id === theme ? " active" : ""}`}
                    onClick={() => {
                      onChangeTheme(opt.id);
                      setThemeOpen(false);
                    }}
                  >
                    <span className={`theme-sw-swatch ${opt.id}`} />
                    {opt.label}
                    <span className="theme-sw-opt-check">✓</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <Link href="/student/dashboard" className="dash-btn">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <rect x="1" y="1" width="6" height="6" rx="1.5" />
            <rect x="9" y="1" width="6" height="6" rx="1.5" />
            <rect x="1" y="9" width="6" height="6" rx="1.5" />
            <rect x="9" y="9" width="6" height="6" rx="1.5" />
          </svg>
          Dashboard
        </Link>

        <button className="leave-btn" onClick={onLeave}>
          Leave
        </button>

        <div className="stu-av">{userInitial}</div>
      </div>
    </div>
  );
}
