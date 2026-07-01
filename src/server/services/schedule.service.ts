import "server-only";
import type { DocumentReference } from "firebase-admin/firestore";
import { adminDb } from "@/server/firebase-admin";
import { Collections } from "@/shared/constants/collections";
import { resolveSubjectName } from "@/shared/constants/subjects";
import { leaveService } from "@/server/services/leave.service";
import { teacherSubjects } from "@/server/services/cover.service";
import { groqProvider, type ChatMessage } from "@/server/providers/ai/groq";
import type {
  AvailabilityBlock,
  TeacherAvailability,
} from "@/shared/types/domain";
import type { AvailabilitySaveInput } from "@/shared/schemas/schedule.schema";

/* ───────────────────────── time helpers ───────────────────────── */

const DAY_START = 8 * 60; // 08:00 earliest class start
const LATEST_START = 21 * 60; // 21:00 latest class start
const DAY_END = 22 * 60; // 22:00 hard end
const ALLOWED_DURATIONS = [30, 45, 60, 90];

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}
function toHHMM(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}
/** Monday = 0 … Sunday = 6, anchored at UTC midnight (TZ-stable). */
function dayOfWeekMon0(dateStr: string): number {
  return (new Date(`${dateStr}T00:00:00Z`).getUTCDay() + 6) % 7;
}
function ymd(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
    d.getUTCDate(),
  ).padStart(2, "0")}`;
}
function addDaysStr(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return ymd(d);
}
/** Monday (YYYY-MM-DD) of the week containing dateStr. */
function weekStartMon(dateStr: string): string {
  return addDaysStr(dateStr, -dayOfWeekMon0(dateStr));
}
function weekDates(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDaysStr(weekStart, i));
}
function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}
function overlaps(s1: number, e1: number, s2: number, e2: number): boolean {
  return s1 < e2 && s2 < e1;
}
function normSubject(s: string | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

type TimetableEntry = {
  classroomId: string;
  day: number; // Mon=0
  start: number; // minutes
  durationMin: number;
};
/** day-of-week occupied window for cross-teacher same-subject de-confliction. */
type OccupiedSlot = { day: number; start: number; end: number };

type MeetingDoc = {
  classroomId?: string;
  teacherId?: string;
  status?: string;
  scheduleStatus?: string;
  startedAt?: string;
  scheduledDate?: string;
  scheduledTime?: string;
  durationMin?: number;
  subjectName?: string;
  syllabus?: string;
  grade?: number;
  title?: string;
  source?: string;
};

type ClassroomLite = {
  id: string;
  name: string;
  subjectName: string;
  grade: number;
  syllabus?: string;
  students: number;
};

/* ───────────────────────── service ───────────────────────── */

export const scheduleService = {
  async getAvailability(teacherId: string): Promise<TeacherAvailability> {
    const doc = await adminDb
      .collection(Collections.TEACHER_AVAILABILITY)
      .doc(teacherId)
      .get();
    if (!doc.exists) return { teacherId, blocks: [] };
    const data = doc.data() ?? {};
    return {
      teacherId,
      timezone: (data.timezone as string | undefined) ?? undefined,
      blocks: (data.blocks as AvailabilityBlock[] | undefined) ?? [],
      updatedAt: (data.updatedAt as string | undefined) ?? undefined,
    };
  },

  async saveAvailability(teacherId: string, input: AvailabilitySaveInput) {
    const blocks = input.blocks
      .map((b) => ({ day: b.day, start: b.start, end: b.end }))
      .filter((b) => toMinutes(b.end) > toMinutes(b.start));
    const payload = {
      teacherId,
      timezone: input.timezone ?? null,
      blocks,
      updatedAt: new Date().toISOString(),
    };
    await adminDb
      .collection(Collections.TEACHER_AVAILABILITY)
      .doc(teacherId)
      .set(payload, { merge: true });
    return { teacherId, blocks, timezone: payload.timezone };
  },

  /* ───────────────────── reads ───────────────────── */

  async listMonth(teacherId: string, year: number, monthIdx0: number) {
    const prefix = `${year}-${String(monthIdx0 + 1).padStart(2, "0")}`;
    const [meetingsSnap, classroomsSnap] = await Promise.all([
      adminDb.collection(Collections.MEETINGS).where("teacherId", "==", teacherId).get(),
      adminDb.collection(Collections.CLASSROOMS).where("teacherId", "==", teacherId).get(),
    ]);

    const classroomById = new Map(
      classroomsSnap.docs.map((d) => {
        const c = d.data() as {
          name?: string;
          subjectId?: string;
          subjectName?: string;
          syllabus?: string;
          grade?: number;
        };
        return [
          d.id,
          {
            name: c.name ?? "Class",
            subjectName: c.subjectName ?? resolveSubjectName(c.subjectId ?? "", c.subjectName),
            syllabus: c.syllabus,
            grade: c.grade,
          },
        ];
      }),
    );

    const rows = meetingsSnap.docs
      .map((d) => hydrateMeeting(d.id, d.data() as MeetingDoc, classroomById))
      .filter((r) => r.scheduledDate?.startsWith(prefix));
    rows.sort((a, b) =>
      `${a.scheduledDate}T${a.scheduledTime}`.localeCompare(`${b.scheduledDate}T${b.scheduledTime}`),
    );
    return rows;
  },

  /** The teacher's current pending (proposed) batch, if any — for the
   *  review banner + dashboard nudge. Grouped to its (earliest) week. */
  async getPendingProposal(teacherId: string) {
    const snap = await adminDb
      .collection(Collections.MEETINGS)
      .where("teacherId", "==", teacherId)
      .get();
    const proposed = snap.docs
      .map((d) => d.data() as MeetingDoc)
      .filter((m) => m.scheduleStatus === "proposed" && m.status === "scheduled" && m.scheduledDate);
    if (proposed.length === 0) return null;

    const dates = proposed.map((m) => m.scheduledDate!).sort();
    const weekStart = weekStartMon(dates[0]);
    return {
      weekStart,
      weekEnd: addDaysStr(weekStart, 6),
      count: proposed.length,
    };
  },

  async clearMonth(teacherId: string, year: number, monthIdx0: number) {
    const prefix = `${year}-${String(monthIdx0 + 1).padStart(2, "0")}`;
    const today = todayStr();
    const snap = await adminDb
      .collection(Collections.MEETINGS)
      .where("teacherId", "==", teacherId)
      .get();
    const toDelete = snap.docs.filter((d) => {
      const m = d.data() as MeetingDoc;
      const date = m.scheduledDate ?? m.startedAt?.slice(0, 10) ?? "";
      return m.source === "ai" && m.status === "scheduled" && date.startsWith(prefix) && date >= today;
    });
    await commitInChunks(toDelete.map((d) => ({ type: "delete" as const, ref: d.ref })));
    return toDelete.length;
  },

  /* ───────────────────── generation (weekly proposals) ───────────────────── */

  async generate(
    teacherId: string,
    opts: { weekStart?: string; sessionsPerWeek?: number },
  ) {
    const sessionsPerWeek = Math.min(Math.max(opts.sessionsPerWeek ?? 2, 1), 5);

    const classrooms = await loadClassrooms(teacherId);
    if (classrooms.length === 0)
      return { created: 0, weekStart: null, usedAi: false, reason: "no-classrooms" as const };

    const meetingsSnap = await adminDb
      .collection(Collections.MEETINGS)
      .where("teacherId", "==", teacherId)
      .get();
    const myMeetings = meetingsSnap.docs.map((d) => ({ id: d.id, ref: d.ref, ...(d.data() as MeetingDoc) }));

    // Target week: explicit (e.g. Regenerate), else the running week — but only
    // when today or tomorrow still has no class.
    const targetWeek = opts.weekStart ?? currentWeekIfNeeded(myMeetings);
    if (!targetWeek)
      return { created: 0, weekStart: null, usedAi: false, reason: "already-scheduled" as const };

    const availability = await this.getAvailability(teacherId);
    // While *placing* new slots, stagger around other same-subject teachers'
    // approved AND still-proposed classes, so two teachers proposing close
    // together don't land on the same time.
    const occupied = await gatherOccupiedBySubject(teacherId, classrooms, {
      includeProposed: true,
    });
    const classroomSubjectNorm = new Map(
      classrooms.map((c) => [c.id, normSubject(c.subjectName)]),
    );

    let timetable: TimetableEntry[] = [];
    let usedAi = false;
    try {
      const raw = await requestTimetableFromAi(classrooms, availability.blocks, sessionsPerWeek);
      timetable = sanitizeTimetable(raw, classrooms, availability.blocks, occupied, classroomSubjectNorm);
      usedAi = timetable.length > 0;
    } catch (err) {
      console.warn("[schedule] AI timetable failed, using fallback:", err);
    }
    if (timetable.length === 0)
      timetable = fallbackTimetable(classrooms, availability.blocks, occupied, classroomSubjectNorm, sessionsPerWeek);

    // Replace any existing proposed meetings in the target week (keep approved).
    const weekSet = new Set(weekDates(targetWeek));
    const staleProposed = myMeetings.filter(
      (m) =>
        m.scheduleStatus === "proposed" &&
        m.status === "scheduled" &&
        m.scheduledDate &&
        weekSet.has(m.scheduledDate),
    );

    // Days that already have a committed (approved/legacy, non-ended) class —
    // we never pile new auto-proposals onto a day the teacher already has a
    // schedule for; only the empty days get filled.
    const committedDates = new Set(
      myMeetings
        .filter((m) => m.status !== "ended" && m.scheduleStatus !== "proposed")
        .map((m) => m.scheduledDate ?? m.startedAt?.slice(0, 10))
        .filter((d): d is string => !!d),
    );

    const classroomMeta = new Map(classrooms.map((c) => [c.id, c]));
    const today = todayStr();
    const leaveDates = await leaveService.approvedLeaveDates(teacherId);
    const writes: ChunkOp[] = staleProposed.map((m) => ({ type: "delete", ref: m.ref }));
    let created = 0;
    for (const date of weekDates(targetWeek)) {
      if (date < today) continue;
      if (leaveDates.has(date)) continue; // teacher is on approved leave
      if (committedDates.has(date)) continue; // day already has a committed class
      const dow = dayOfWeekMon0(date);
      for (const entry of timetable) {
        if (entry.day !== dow) continue;
        const meta = classroomMeta.get(entry.classroomId);
        if (!meta) continue;
        const time = toHHMM(entry.start);
        const ref = adminDb.collection(Collections.MEETINGS).doc();
        writes.push({
          type: "set",
          ref,
          data: {
            classroomId: entry.classroomId,
            teacherId,
            videosdkRoomId: null,
            status: "scheduled",
            scheduleStatus: "proposed",
            startedAt: `${date}T${time}:00.000Z`,
            endedAt: null,
            recordingUrl: null,
            currentSlide: null,
            participantIds: [],
            scheduledDate: date,
            scheduledTime: time,
            durationMin: entry.durationMin,
            subjectName: meta.subjectName,
            syllabus: meta.syllabus ?? null,
            grade: meta.grade ?? null,
            title: meta.name,
            source: "ai",
          },
        });
        created++;
      }
    }
    await commitInChunks(writes);

    return {
      created,
      weekStart: targetWeek,
      weekEnd: addDaysStr(targetWeek, 6),
      usedAi,
      reason: "ok" as const,
    };
  },

  /** Lazily ensure today + tomorrow are covered. If the teacher already has a
   *  class for both today and tomorrow, do nothing. Otherwise fill the running
   *  week's empty days. Skips if auto is disabled, or we already auto-proposed
   *  this exact week (so a discard isn't instantly undone). */
  async autoProposeIfNeeded(teacherId: string) {
    const availRef = adminDb.collection(Collections.TEACHER_AVAILABILITY).doc(teacherId);
    const availDoc = await availRef.get();
    const availData = availDoc.data() ?? {};
    if (availData.autoProposeEnabled === false) return null;
    const lastAutoWeek = availData.lastAutoWeek as string | undefined;

    const classrooms = await loadClassrooms(teacherId);
    if (classrooms.length === 0) return null;

    const snap = await adminDb
      .collection(Collections.MEETINGS)
      .where("teacherId", "==", teacherId)
      .get();
    const myMeetings = snap.docs.map((d) => d.data() as MeetingDoc);

    const target = currentWeekIfNeeded(myMeetings);
    if (!target || target === lastAutoWeek) return null;

    const res = await this.generate(teacherId, { weekStart: target });
    await availRef.set(
      { teacherId, lastAutoWeek: target, updatedAt: new Date().toISOString() },
      { merge: true },
    );
    return res.created > 0 ? { weekStart: target, created: res.created } : null;
  },

  /** Publish the teacher's proposed batch. Drops any proposed class that now
   *  collides with an approved same-subject class from another teacher. */
  async approve(teacherId: string, opts: { weekStart?: string }) {
    const classrooms = await loadClassrooms(teacherId);
    // At publish time only drop a class against a *real* approved clash — never
    // against another teacher's still-discardable proposal.
    const occupied = await gatherOccupiedBySubject(teacherId, classrooms);

    const snap = await adminDb
      .collection(Collections.MEETINGS)
      .where("teacherId", "==", teacherId)
      .get();
    const weekSet = opts.weekStart ? new Set(weekDates(opts.weekStart)) : null;
    const approvedAt = new Date().toISOString();

    const writes: ChunkOp[] = [];
    let approved = 0;
    let skipped = 0;
    for (const d of snap.docs) {
      const m = d.data() as MeetingDoc;
      if (m.scheduleStatus !== "proposed" || m.status !== "scheduled" || !m.scheduledDate) continue;
      if (weekSet && !weekSet.has(m.scheduledDate)) continue;

      const sub = normSubject(m.subjectName);
      const start = m.scheduledTime ? toMinutes(m.scheduledTime) : 0;
      const end = start + (m.durationMin ?? 60);
      const day = dayOfWeekMon0(m.scheduledDate);
      const clash = (occupied.get(sub) ?? []).some(
        (o) => o.day === day && overlaps(start, end, o.start, o.end),
      );
      if (clash) {
        writes.push({ type: "delete", ref: d.ref });
        skipped++;
      } else {
        writes.push({
          type: "update",
          ref: d.ref,
          data: { scheduleStatus: "approved", approvedAt },
        });
        approved++;
      }
    }
    await commitInChunks(writes);
    return { approved, skipped };
  },

  /** Delete the teacher's proposed batch (optionally just one week). */
  async discard(teacherId: string, opts: { weekStart?: string }) {
    const snap = await adminDb
      .collection(Collections.MEETINGS)
      .where("teacherId", "==", teacherId)
      .get();
    const weekSet = opts.weekStart ? new Set(weekDates(opts.weekStart)) : null;
    const toDelete = snap.docs.filter((d) => {
      const m = d.data() as MeetingDoc;
      if (m.scheduleStatus !== "proposed" || m.status !== "scheduled" || !m.scheduledDate) return false;
      return !weekSet || weekSet.has(m.scheduledDate);
    });
    await commitInChunks(toDelete.map((d) => ({ type: "delete" as const, ref: d.ref })));
    return { discarded: toDelete.length };
  },
};

/* ───────────────────── shared loaders ───────────────────── */

function hydrateMeeting(
  id: string,
  m: MeetingDoc,
  classroomById: Map<
    string,
    { name: string; subjectName: string; syllabus?: string; grade?: number }
  >,
) {
  const cls = classroomById.get(m.classroomId ?? "");
  return {
    id,
    classroomId: m.classroomId ?? "",
    classroomName: cls?.name ?? m.title ?? "Class",
    subjectName: m.subjectName ?? cls?.subjectName ?? "",
    // Prefer the value stamped on the meeting; fall back to the classroom's
    // current board/grade so meetings scheduled before this was stored (or
    // classrooms that only set a board later) still display correctly.
    syllabus: m.syllabus ?? cls?.syllabus ?? "",
    grade: m.grade ?? cls?.grade,
    status: m.status ?? "scheduled",
    scheduleStatus: (m.scheduleStatus as string | undefined) ?? "approved",
    scheduledDate: m.scheduledDate ?? m.startedAt?.slice(0, 10),
    scheduledTime: m.scheduledTime ?? m.startedAt?.slice(11, 16),
    durationMin: m.durationMin ?? 60,
    source: m.source ?? "manual",
  };
}

async function loadClassrooms(teacherId: string): Promise<ClassroomLite[]> {
  const [snap, userDoc] = await Promise.all([
    adminDb.collection(Collections.CLASSROOMS).where("teacherId", "==", teacherId).get(),
    adminDb.collection(Collections.USERS).doc(teacherId).get(),
  ]);

  const all = snap.docs.map((d) => {
    const c = d.data() as {
      name?: string;
      subjectId?: string;
      subjectName?: string;
      grade?: number;
      syllabus?: string;
      studentIds?: string[];
    };
    return {
      id: d.id,
      name: c.name ?? "Class",
      subjectName: c.subjectName ?? resolveSubjectName(c.subjectId ?? "", c.subjectName),
      grade: c.grade ?? 0,
      syllabus: c.syllabus,
      students: c.studentIds?.length ?? 0,
    };
  });

  // Only schedule subjects the teacher actually teaches (their declared
  // subjects / specializations). A teacher of English + Math never gets a
  // class in any other subject. If the teacher has declared no subjects, we
  // don't restrict (otherwise they'd get no schedule at all).
  const subjectSet = new Set(teacherSubjects(userDoc.data() ?? {}));
  if (subjectSet.size === 0) return all;
  return all.filter((c) => subjectSet.has(normSubject(c.subjectName)));
}

/** Product rule: the AI keeps the **running week** filled, but only kicks in
 *  when **today or tomorrow has no class yet**. If the teacher already has a
 *  class scheduled for BOTH today and tomorrow, there's nothing to create.
 *  Returns this week's Monday when (re)generation is needed, else null.
 *  (Generation itself skips days that already have a committed class, so only
 *  the genuinely empty days get filled.) */
function currentWeekIfNeeded(
  meetings: { scheduledDate?: string; startedAt?: string }[],
): string | null {
  const today = todayStr();
  const tomorrow = addDaysStr(today, 1);
  const scheduled = new Set(
    meetings
      .map((m) => m.scheduledDate ?? m.startedAt?.slice(0, 10))
      .filter((d): d is string => !!d),
  );
  const covered = scheduled.has(today) && scheduled.has(tomorrow);
  return covered ? null : weekStartMon(today);
}

/** Approved same-subject classes from OTHER teachers → occupied weekly slots,
 *  so no two teachers of one subject collide. */
async function gatherOccupiedBySubject(
  teacherId: string,
  classrooms: ClassroomLite[],
  opts: { includeProposed?: boolean } = {},
): Promise<Map<string, OccupiedSlot[]>> {
  const out = new Map<string, OccupiedSlot[]>();
  const subjectNames = Array.from(
    new Set(classrooms.map((c) => c.subjectName).filter((s): s is string => !!s)),
  );
  if (subjectNames.length === 0) return out;

  const docs: MeetingDoc[] = [];
  for (let i = 0; i < subjectNames.length; i += 30) {
    const batch = subjectNames.slice(i, i + 30);
    const snap = await adminDb
      .collection(Collections.MEETINGS)
      .where("subjectName", "in", batch)
      .get();
    snap.docs.forEach((d) => docs.push(d.data() as MeetingDoc));
  }

  for (const m of docs) {
    if (m.teacherId === teacherId) continue; // ignore own classes
    // Approved/legacy classes always block; proposals from other teachers block
    // only while placing (includeProposed), so generation staggers around them.
    if (m.scheduleStatus === "proposed" && !opts.includeProposed) continue;
    if (m.status === "ended") continue;
    if (!m.scheduledDate || !m.scheduledTime) continue;
    const sub = normSubject(m.subjectName);
    const start = toMinutes(m.scheduledTime);
    const slot: OccupiedSlot = {
      day: dayOfWeekMon0(m.scheduledDate),
      start,
      end: start + (m.durationMin ?? 60),
    };
    const arr = out.get(sub) ?? [];
    arr.push(slot);
    out.set(sub, arr);
  }
  return out;
}

/* ───────────────────── AI prompt + sanitisation ───────────────────── */

async function requestTimetableFromAi(
  classrooms: ClassroomLite[],
  blocks: AvailabilityBlock[],
  sessionsPerWeek: number,
): Promise<unknown[]> {
  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const classList = classrooms
    .map(
      (c) =>
        `- id="${c.id}" | "${c.name}" | subject: ${c.subjectName || "General"} | grade ${c.grade} | board: ${c.syllabus || "General"} | ${c.students} students`,
    )
    .join("\n");
  const blockList = blocks.length
    ? blocks.map((b) => `- ${dayNames[b.day] ?? b.day}: ${b.start}–${b.end} UNAVAILABLE`).join("\n")
    : "- none (teacher is available all week)";

  const messages: ChatMessage[] = [
    {
      role: "system",
      content:
        "You are a scheduling assistant for a live online tutoring platform. " +
        "Design a sensible weekly recurring timetable for one teacher. Spread sessions across " +
        "different weekdays, keep each class in a consistent slot, and NEVER place a class inside " +
        "an unavailable window. Start times must be on the hour or half-hour between 08:00 and 21:00, " +
        "every class ending by 22:00. Return ONLY valid JSON, no prose, no code fences.",
    },
    {
      role: "user",
      content:
        `Classes to schedule:\n${classList}\n\n` +
        `Teacher weekly UNAVAILABLE windows:\n${blockList}\n\n` +
        `Give each class about ${sessionsPerWeek} session(s) per week on different days. ` +
        `Return JSON of this exact shape:\n` +
        `{"timetable":[{"classroomId":"<id from list>","day":<0-6, Mon=0>,"startTime":"HH:MM","durationMin":<30|45|60|90>}]}`,
    },
  ];

  const text = await groqProvider.chat(messages, { temperature: 0.3 });
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON in AI response");
  const parsed = JSON.parse(match[0]) as { timetable?: unknown };
  if (!Array.isArray(parsed.timetable)) throw new Error("No timetable array");
  return parsed.timetable;
}

function slotIsBlocked(day: number, start: number, end: number, blocks: AvailabilityBlock[]): boolean {
  return blocks.some(
    (b) => b.day === day && overlaps(start, end, toMinutes(b.start), toMinutes(b.end)),
  );
}
function slotHitsOccupied(
  classroomId: string,
  day: number,
  start: number,
  end: number,
  occupied: Map<string, OccupiedSlot[]>,
  classroomSubjectNorm: Map<string, string>,
): boolean {
  const sub = classroomSubjectNorm.get(classroomId) ?? "";
  return (occupied.get(sub) ?? []).some(
    (o) => o.day === day && overlaps(start, end, o.start, o.end),
  );
}

function sanitizeTimetable(
  raw: unknown[],
  classrooms: ClassroomLite[],
  blocks: AvailabilityBlock[],
  occupied: Map<string, OccupiedSlot[]>,
  classroomSubjectNorm: Map<string, string>,
): TimetableEntry[] {
  const classroomIds = new Set(classrooms.map((c) => c.id));
  const accepted: TimetableEntry[] = [];

  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;

    const classroomId = String(o.classroomId ?? "");
    if (!classroomIds.has(classroomId)) continue;

    const day = Number(o.day);
    if (!Number.isInteger(day) || day < 0 || day > 6) continue;

    const startRaw = String(o.startTime ?? "");
    if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(startRaw)) continue;
    let start = Math.round(toMinutes(startRaw) / 30) * 30;
    start = Math.min(Math.max(start, DAY_START), LATEST_START);

    let durationMin = Number(o.durationMin);
    if (!ALLOWED_DURATIONS.includes(durationMin)) durationMin = 60;
    if (start + durationMin > DAY_END) durationMin = DAY_END - start;
    if (durationMin < 30) continue;
    const end = start + durationMin;

    if (slotIsBlocked(day, start, end, blocks)) continue;
    if (slotHitsOccupied(classroomId, day, start, end, occupied, classroomSubjectNorm)) continue;
    // No overlap with an already-accepted class on the same day.
    if (accepted.some((a) => a.day === day && overlaps(start, end, a.start, a.start + a.durationMin)))
      continue;

    accepted.push({ classroomId, day, start, durationMin });
  }
  return accepted;
}

function fallbackTimetable(
  classrooms: ClassroomLite[],
  blocks: AvailabilityBlock[],
  occupied: Map<string, OccupiedSlot[]>,
  classroomSubjectNorm: Map<string, string>,
  sessionsPerWeek: number,
): TimetableEntry[] {
  const out: TimetableEntry[] = [];
  const duration = 60;
  const candidateDays = [0, 1, 2, 3, 4];
  const candidateStarts = [9, 10, 11, 12, 13, 14, 15, 16, 17].map((h) => h * 60);

  const isFree = (classroomId: string, day: number, start: number) => {
    const end = start + duration;
    if (end > DAY_END) return false;
    if (slotIsBlocked(day, start, end, blocks)) return false;
    if (slotHitsOccupied(classroomId, day, start, end, occupied, classroomSubjectNorm)) return false;
    if (out.some((a) => a.day === day && overlaps(start, end, a.start, a.start + a.durationMin)))
      return false;
    return true;
  };

  classrooms.forEach((c, ci) => {
    let placed = 0;
    for (let s = 0; s < candidateStarts.length && placed < sessionsPerWeek; s++) {
      for (let di = 0; di < candidateDays.length && placed < sessionsPerWeek; di++) {
        const day = candidateDays[(di + ci) % candidateDays.length];
        const start = candidateStarts[s];
        if (isFree(c.id, day, start)) {
          out.push({ classroomId: c.id, day, start, durationMin: duration });
          placed++;
        }
      }
    }
  });
  return out;
}

/* ───────────────────── batched writes ───────────────────── */

type ChunkOp =
  | { type: "set"; ref: DocumentReference; data: Record<string, unknown> }
  | { type: "update"; ref: DocumentReference; data: Record<string, unknown> }
  | { type: "delete"; ref: DocumentReference };

async function commitInChunks(ops: ChunkOp[]) {
  const CHUNK = 450;
  for (let i = 0; i < ops.length; i += CHUNK) {
    const batch = adminDb.batch();
    for (const op of ops.slice(i, i + CHUNK)) {
      if (op.type === "set") batch.set(op.ref, op.data);
      else if (op.type === "update") batch.update(op.ref, op.data);
      else batch.delete(op.ref);
    }
    await batch.commit();
  }
}
