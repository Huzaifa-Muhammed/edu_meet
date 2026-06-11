import api from "@/lib/api/client";

export type TranscriptSegment = {
  id: string;
  text: string;
  ts: number;
  name?: string;
};

export type TranscriptMeta = {
  classroomName: string;
  subjectName?: string;
  teacherName?: string;
  /** ISO date or datetime; used for the header line. */
  date?: string;
};

/* ── Client-side outbox ──────────────────────────────────────────────
 * The host's LiveCaptions pushes finalised segments here; a periodic
 * flusher drains the buffer to the server. Kept module-scoped (not React
 * state) so a forced flush from the end-of-class flow can drain it too. */
const buffers = new Map<string, TranscriptSegment[]>();

/** Queue a finalised caption segment for the meeting's transcript. */
export function bufferSegment(
  meetingId: string,
  seg: { text: string; ts: number; name?: string },
) {
  const text = seg.text.trim();
  if (!text) return;
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${seg.ts}-${Math.round(Math.random() * 1e9)}`;
  const arr = buffers.get(meetingId) ?? [];
  arr.push({ id, text, ts: seg.ts, name: seg.name });
  buffers.set(meetingId, arr);
}

export function pendingCount(meetingId: string) {
  return buffers.get(meetingId)?.length ?? 0;
}

/** Drain the outbox to the server. On failure the batch is re-queued so the
 *  next flush retries it (order preserved). Safe to call concurrently — the
 *  splice claims the current batch atomically in JS's single-threaded model. */
export async function flushTranscript(meetingId: string) {
  const arr = buffers.get(meetingId);
  if (!arr || arr.length === 0) return;
  const batch = arr.splice(0, arr.length);
  try {
    await api.post(`/meetings/${meetingId}/transcript`, { segments: batch });
  } catch {
    const cur = buffers.get(meetingId) ?? [];
    buffers.set(meetingId, [...batch, ...cur]);
  }
}

export async function fetchTranscript(meetingId: string) {
  return api.get(`/meetings/${meetingId}/transcript`) as unknown as Promise<{
    meetingId: string;
    segments: TranscriptSegment[];
  }>;
}

function esc(s: string) {
  return s.replace(
    /[&<>]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] ?? c,
  );
}

function clock(ts: number) {
  try {
    return new Date(ts).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

/** Opens a print-friendly window with the transcript and triggers the
 *  browser's print dialog (Save as PDF). Dependency-free — mirrors the
 *  class-recap download. */
export function downloadTranscriptPdf(
  meta: TranscriptMeta,
  segments: TranscriptSegment[],
) {
  const w = window.open("", "_blank", "width=820,height=920");
  if (!w) return;

  const dateLabel = meta.date
    ? new Date(meta.date).toLocaleString([], {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "";

  const rows = segments.length
    ? segments
        .map(
          (s) =>
            `<div class="line"><span class="t">${esc(clock(s.ts))}</span>${
              s.name ? `<span class="sp">${esc(s.name)}</span>` : ""
            }<span class="x">${esc(s.text)}</span></div>`,
        )
        .join("")
    : `<p class="empty">No transcript was captured for this class.</p>`;

  const metaLine = [meta.subjectName, meta.teacherName, dateLabel]
    .filter(Boolean)
    .map((p) => esc(String(p)))
    .join(" · ");

  const html = `<!doctype html><html><head><meta charset="utf-8"/><title>Transcript — ${esc(
    meta.classroomName,
  )}</title><style>
    body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1a1a1a;max-width:720px;margin:32px auto;padding:0 24px;line-height:1.5}
    h1{font-size:22px;margin:0 0 4px}
    .meta{color:#666;font-size:13px;margin-bottom:8px}
    .sub{color:#888;font-size:11px;margin-bottom:20px;text-transform:uppercase;letter-spacing:.5px}
    .line{display:flex;gap:10px;align-items:baseline;margin:7px 0;font-size:13px}
    .t{color:#999;font-size:11px;font-variant-numeric:tabular-nums;flex:0 0 52px}
    .sp{color:#4f46e5;font-weight:600;flex:0 0 auto}
    .x{flex:1}
    .empty{color:#999;font-size:13px}
  </style></head><body>
    <h1>${esc(meta.classroomName)}</h1>
    ${metaLine ? `<div class="meta">${metaLine}</div>` : ""}
    <div class="sub">Class transcript</div>
    ${rows}
    <script>window.onload=function(){setTimeout(function(){window.print()},250)}</script>
  </body></html>`;
  w.document.write(html);
  w.document.close();
}
