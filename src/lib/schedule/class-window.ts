/**
 * Class-time math in the **viewer's local timezone**.
 *
 * Scheduled classes store a wall-clock `scheduledDate` ("YYYY-MM-DD") +
 * `scheduledTime` ("HH:MM") that are meant to read as the viewer's local clock
 * (see schedule.service.ts notes). We deliberately parse them WITHOUT a "Z" so
 * the browser interprets them in local time — this keeps the 2-minute reminder
 * and the "ongoing now" detection correct for each viewer without any timezone
 * infrastructure on the server.
 */

/** Shape returned by the teacher/student class-alert endpoints and consumed by
 *  the reminder popups. `enrolled` is student-only. */
export type ClassAlert = {
  meetingId: string;
  classroomName: string;
  subjectName: string;
  scheduledDate: string;
  scheduledTime: string;
  durationMin: number;
  status: string;
  enrolled?: boolean;
};

export type WindowState = {
  /** Minutes until the class starts (negative once it has started). */
  startsInMin: number;
  /** Within the lead window before start (e.g. the last ~2 minutes). */
  imminent: boolean;
  /** Now is between start and start+duration. */
  ongoing: boolean;
  /** Now is past start+duration. */
  ended: boolean;
};

/**
 * Compute the window state of a scheduled class relative to "now" in local time.
 * `leadMin` is the reminder lead (default 2 min); we widen the imminent test
 * slightly so a ~30s poll reliably catches the 2-minute mark.
 */
export function classWindow(
  scheduledDate: string | undefined,
  scheduledTime: string | undefined,
  durationMin: number | undefined,
  leadMin = 2,
): WindowState {
  if (!scheduledDate || !scheduledTime) {
    return { startsInMin: Infinity, imminent: false, ongoing: false, ended: false };
  }
  const target = new Date(`${scheduledDate}T${scheduledTime}:00`).getTime();
  if (Number.isNaN(target)) {
    return { startsInMin: Infinity, imminent: false, ongoing: false, ended: false };
  }
  const dur = durationMin && durationMin > 0 ? durationMin : 60;
  const now = Date.now();
  const startsInMin = (target - now) / 60_000;
  const end = target + dur * 60_000;

  const ongoing = now >= target && now < end;
  const ended = now >= end;
  // Widen by half a poll interval so a 30s cadence doesn't skip past the mark.
  const imminent = startsInMin > 0 && startsInMin <= leadMin + 0.5;

  return { startsInMin, imminent, ongoing, ended };
}
