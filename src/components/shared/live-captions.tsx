"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMeeting, usePubSub } from "@videosdk.live/react-sdk";
import { Captions, X, ChevronDown } from "lucide-react";
import api from "@/lib/api/client";
import { useAuth } from "@/providers/auth-provider";

/** Languages we recognise + render captions in. recognitionLang is the
 *  BCP-47 tag the browser SpeechRecognition expects; the short id is what
 *  we send to /api/ai/translate. */
const LANGUAGES: { id: string; name: string; recognitionLang: string }[] = [
  { id: "en", name: "English", recognitionLang: "en-US" },
  { id: "es", name: "Spanish", recognitionLang: "es-ES" },
  { id: "fr", name: "French", recognitionLang: "fr-FR" },
  { id: "de", name: "German", recognitionLang: "de-DE" },
  { id: "hi", name: "Hindi", recognitionLang: "hi-IN" },
  { id: "ar", name: "Arabic", recognitionLang: "ar-SA" },
  { id: "zh", name: "Chinese", recognitionLang: "zh-CN" },
  { id: "pt", name: "Portuguese", recognitionLang: "pt-BR" },
  { id: "ur", name: "Urdu", recognitionLang: "ur-PK" },
  { id: "ja", name: "Japanese", recognitionLang: "ja-JP" },
  { id: "ko", name: "Korean", recognitionLang: "ko-KR" },
  { id: "it", name: "Italian", recognitionLang: "it-IT" },
];

const STORAGE_KEY = "liveCaptionsPrefs";
const CAPTION_TTL_MS = 10_000;
const MAX_VISIBLE = 3;
const MIN_PUBLISH_INTERVAL_MS = 250;

type Caption = {
  id: string;
  uid: string;
  name: string;
  text: string;
  lang: string;
  final: boolean;
  ts: number;
  translated?: string;
  translating?: boolean;
};

type Prefs = {
  enabled: boolean;
  sourceLang: string;
  targetLang: string;
};

const DEFAULT_PREFS: Prefs = {
  enabled: false,
  sourceLang: "en",
  targetLang: "en",
};

/** Per-tab translation cache. Avoids re-translating the same caption when
 *  it's a repeat or interim → final updates with identical text. */
const translationCache = new Map<string, string>();
const cacheKey = (text: string, target: string) => `${target}::${text}`;

/** Live-caption overlay. Mount once inside an EdumeetMeetingProvider on
 *  any container that has position:relative. Renders its own toggle
 *  button + settings popover and a fading caption strip at the bottom. */
export function LiveCaptions({ className }: { className?: string }) {
  const { user } = useAuth();
  const { localMicOn } = useMeeting();
  const { publish, messages } = usePubSub("LIVE_CAPTION");

  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [, forceTick] = useState(0);
  const lastPublishRef = useRef<number>(0);
  const supported = useMemo(
    () =>
      typeof window !== "undefined" &&
      !!(
        (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition ||
        (window as unknown as { webkitSpeechRecognition?: unknown })
          .webkitSpeechRecognition
      ),
    [],
  );

  // ── Prefs persistence ────────────────────────────────────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const p = JSON.parse(raw) as Partial<Prefs>;
        setPrefs({ ...DEFAULT_PREFS, ...p });
      }
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {}
  }, [prefs]);

  // ── TTL tick — keeps the visible window updated as captions age out ──
  useEffect(() => {
    const id = setInterval(() => forceTick((t) => t + 1), 1500);
    return () => clearInterval(id);
  }, []);

  // ── Speech Recognition lifecycle ─────────────────────────────
  useEffect(() => {
    if (!prefs.enabled || !localMicOn || !supported) return;
    const SR =
      (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike })
        .SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike })
        .webkitSpeechRecognition;
    if (!SR) return;

    const langDef = LANGUAGES.find((l) => l.id === prefs.sourceLang);
    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = langDef?.recognitionLang ?? "en-US";

    let stopped = false;

    recognition.onresult = (e: SpeechRecognitionEventLike) => {
      let interim = "";
      let final = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) final += r[0].transcript;
        else interim += r[0].transcript;
      }
      const text = (final || interim).trim();
      if (!text) return;

      const now = Date.now();
      // Throttle interim publishes to ~4Hz; always publish finals.
      if (!final && now - lastPublishRef.current < MIN_PUBLISH_INTERVAL_MS) return;
      lastPublishRef.current = now;

      publish(
        JSON.stringify({
          id: `${user?.uid ?? "anon"}-${now}`,
          uid: user?.uid ?? "anon",
          name: user?.displayName ?? "Speaker",
          text,
          lang: prefs.sourceLang,
          final: !!final,
          ts: now,
        }),
        { persist: false },
      );
    };

    recognition.onend = () => {
      if (stopped) return;
      try {
        recognition.start();
      } catch {
        // already started — ignore
      }
    };

    recognition.onerror = (e: { error?: string }) => {
      // common: "no-speech", "aborted" — let onend restart
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        // Permission denied — turn ourselves off so we don't loop
        stopped = true;
        setPrefs((p) => ({ ...p, enabled: false }));
      }
    };

    try {
      recognition.start();
    } catch {
      // already started in some other branch — ok
    }

    return () => {
      stopped = true;
      try {
        recognition.stop();
      } catch {}
    };
  }, [prefs.enabled, prefs.sourceLang, localMicOn, supported, publish, user?.uid, user?.displayName]);

  // ── Consume incoming captions (own + others) ─────────────────
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (!last) return;
    let p: Omit<Caption, "translated" | "translating">;
    try {
      p = JSON.parse(last.message as unknown as string) as Caption;
    } catch {
      return;
    }
    if (!p.text) return;

    setCaptions((prev) => {
      // For a non-final caption from a given uid, replace the latest
      // non-final from that uid; for a final one, append a fresh entry.
      const next = [...prev];
      if (!p.final) {
        const idx = next.findIndex((c) => c.uid === p.uid && !c.final);
        if (idx >= 0) {
          next[idx] = { ...next[idx], text: p.text, ts: p.ts };
          return next;
        }
        next.push({ ...p });
        return next.slice(-12);
      }
      // final: drop any matching interim from this uid + append
      const cleaned = next.filter((c) => !(c.uid === p.uid && !c.final));
      cleaned.push({ ...p });
      return cleaned.slice(-12);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

  // ── Translation: only translate finalised captions whose lang differs ──
  useEffect(() => {
    const targets = captions.filter(
      (c) =>
        c.final &&
        c.lang.toLowerCase() !== prefs.targetLang.toLowerCase() &&
        !c.translated &&
        !c.translating,
    );
    if (targets.length === 0) return;

    for (const c of targets) {
      const key = cacheKey(c.text, prefs.targetLang);
      const cached = translationCache.get(key);
      if (cached) {
        setCaptions((prev) =>
          prev.map((x) => (x.id === c.id ? { ...x, translated: cached } : x)),
        );
        continue;
      }
      // Mark in-flight so we don't fire duplicate calls
      setCaptions((prev) =>
        prev.map((x) => (x.id === c.id ? { ...x, translating: true } : x)),
      );
      api
        .post("/ai/translate", {
          text: c.text,
          sourceLang: c.lang,
          targetLang: prefs.targetLang,
        })
        .then((res) => {
          const translated = (res as unknown as { translatedText: string }).translatedText;
          translationCache.set(key, translated);
          setCaptions((prev) =>
            prev.map((x) =>
              x.id === c.id ? { ...x, translated, translating: false } : x,
            ),
          );
        })
        .catch(() => {
          setCaptions((prev) =>
            prev.map((x) => (x.id === c.id ? { ...x, translating: false } : x)),
          );
        });
    }
  }, [captions, prefs.targetLang]);

  const visible = useMemo(() => {
    const now = Date.now();
    return captions
      .filter((c) => now - c.ts < CAPTION_TTL_MS)
      .slice(-MAX_VISIBLE);
  }, [captions]);

  if (!prefs.enabled && visible.length === 0) {
    // Render only the toggle button when disabled and nothing on screen
    return (
      <CaptionsToggle
        className={className}
        prefs={prefs}
        setPrefs={setPrefs}
        supported={supported}
        settingsOpen={settingsOpen}
        setSettingsOpen={setSettingsOpen}
      />
    );
  }

  return (
    <>
      <CaptionsToggle
        className={className}
        prefs={prefs}
        setPrefs={setPrefs}
        supported={supported}
        settingsOpen={settingsOpen}
        setSettingsOpen={setSettingsOpen}
      />
      {visible.length > 0 && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            bottom: 18,
            transform: "translateX(-50%)",
            zIndex: 20,
            maxWidth: "min(82%, 720px)",
            display: "flex",
            flexDirection: "column",
            gap: 6,
            pointerEvents: "none",
          }}
        >
          {visible.map((c) => {
            const showTranslated =
              c.final &&
              c.translated &&
              c.lang.toLowerCase() !== prefs.targetLang.toLowerCase();
            const display = showTranslated ? c.translated : c.text;
            return (
              <div
                key={c.id}
                style={{
                  background: "rgba(0,0,0,0.78)",
                  color: "white",
                  padding: "7px 14px",
                  borderRadius: 10,
                  fontSize: 14,
                  lineHeight: 1.45,
                  fontWeight: 500,
                  textAlign: "center",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.35)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  opacity: c.final ? 1 : 0.78,
                }}
              >
                <span style={{ opacity: 0.6, fontSize: 11, marginRight: 8 }}>
                  {c.name}:
                </span>
                {display}
                {c.translating && (
                  <span style={{ opacity: 0.5, marginLeft: 6, fontSize: 11 }}>
                    · translating…
                  </span>
                )}
                {showTranslated && (
                  <span
                    style={{
                      opacity: 0.45,
                      marginLeft: 6,
                      fontSize: 10,
                      letterSpacing: 0.4,
                      textTransform: "uppercase",
                    }}
                  >
                    {c.lang} → {prefs.targetLang}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

function CaptionsToggle({
  className,
  prefs,
  setPrefs,
  supported,
  settingsOpen,
  setSettingsOpen,
}: {
  className?: string;
  prefs: Prefs;
  setPrefs: React.Dispatch<React.SetStateAction<Prefs>>;
  supported: boolean;
  settingsOpen: boolean;
  setSettingsOpen: (v: boolean) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!settingsOpen) return;
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [settingsOpen, setSettingsOpen]);

  const toggle = () => {
    if (!supported) return;
    setPrefs((p) => ({ ...p, enabled: !p.enabled }));
  };

  const tooltip = supported
    ? prefs.enabled
      ? "Live captions ON"
      : "Live captions OFF"
    : "Live captions need Chrome or Edge";

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        position: "absolute",
        right: 12,
        top: 12,
        zIndex: 25,
        display: "flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      <button
        type="button"
        onClick={toggle}
        title={tooltip}
        disabled={!supported}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          height: 28,
          padding: "0 10px",
          borderRadius: 999,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 0.2,
          color: prefs.enabled ? "#0F172A" : "white",
          background: prefs.enabled
            ? "linear-gradient(135deg,#FACC15,#F59E0B)"
            : "rgba(0,0,0,0.55)",
          border: prefs.enabled
            ? "1px solid rgba(245,158,11,0.6)"
            : "1px solid rgba(255,255,255,0.18)",
          cursor: supported ? "pointer" : "not-allowed",
          opacity: supported ? 1 : 0.5,
          backdropFilter: "blur(6px)",
        }}
      >
        <Captions size={13} />
        CC
      </button>
      <button
        type="button"
        onClick={() => setSettingsOpen(!settingsOpen)}
        title="Caption settings"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          height: 28,
          padding: "0 8px",
          borderRadius: 999,
          fontSize: 10.5,
          fontWeight: 600,
          color: "white",
          background: "rgba(0,0,0,0.55)",
          border: "1px solid rgba(255,255,255,0.18)",
          cursor: "pointer",
          backdropFilter: "blur(6px)",
        }}
      >
        {LANGUAGES.find((l) => l.id === prefs.targetLang)?.id.toUpperCase() ?? "EN"}
        <ChevronDown size={11} />
      </button>

      {settingsOpen && (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: 36,
            width: 220,
            padding: 10,
            borderRadius: 10,
            background: "rgba(15,23,42,0.95)",
            border: "1px solid rgba(255,255,255,0.12)",
            color: "white",
            boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
            backdropFilter: "blur(8px)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", opacity: 0.8 }}>
              Live Captions
            </span>
            <button
              type="button"
              onClick={() => setSettingsOpen(false)}
              style={{ color: "rgba(255,255,255,0.6)", background: "transparent", border: "none", cursor: "pointer" }}
              aria-label="Close"
            >
              <X size={13} />
            </button>
          </div>

          {!supported && (
            <p style={{ fontSize: 11, color: "#FCA5A5", marginBottom: 8, lineHeight: 1.4 }}>
              Your browser doesn&apos;t support live captions. Try Chrome or Edge.
            </p>
          )}

          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5, marginBottom: 10, cursor: supported ? "pointer" : "not-allowed", opacity: supported ? 1 : 0.5 }}>
            <input
              type="checkbox"
              checked={prefs.enabled}
              onChange={(e) => setPrefs((p) => ({ ...p, enabled: e.target.checked }))}
              disabled={!supported}
            />
            Enable captions for me
          </label>

          <LangSelect
            label="I speak"
            value={prefs.sourceLang}
            onChange={(v) => setPrefs((p) => ({ ...p, sourceLang: v }))}
            disabled={!supported}
          />
          <div style={{ height: 8 }} />
          <LangSelect
            label="Show captions in"
            value={prefs.targetLang}
            onChange={(v) => setPrefs((p) => ({ ...p, targetLang: v }))}
          />

          <p style={{ fontSize: 10, opacity: 0.55, marginTop: 8, lineHeight: 1.4 }}>
            Captions only run while your mic is on. Translation uses Groq AI on
            finalised captions.
          </p>
        </div>
      )}
    </div>
  );
}

function LangSelect({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <label style={{ display: "block", fontSize: 11, opacity: disabled ? 0.5 : 1 }}>
      <span style={{ display: "block", marginBottom: 3, color: "rgba(255,255,255,0.55)" }}>
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        style={{
          width: "100%",
          background: "rgba(255,255,255,0.06)",
          color: "white",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 6,
          padding: "5px 8px",
          fontSize: 12,
        }}
      >
        {LANGUAGES.map((l) => (
          <option key={l.id} value={l.id} style={{ background: "#0F172A" }}>
            {l.name}
          </option>
        ))}
      </select>
    </label>
  );
}

/* ─── minimal local types so we don't pull in lib.dom.d.ts SpeechRecognition ─── */

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}
interface SpeechRecognitionResultListLike {
  length: number;
  [index: number]: SpeechRecognitionResultLike;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: SpeechRecognitionResultListLike;
}
interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  start(): void;
  stop(): void;
}
