/**
 * Canonical fallback subject map. Source of truth for short-id → display
 * name pairs used when the Firestore `subjects` collection isn't populated
 * with proper docs. Keep keys lowercase; common abbreviations included so
 * older classroom data (where subjectId was stored without a paired
 * subjectName) still resolves to a clean label.
 */
export const FALLBACK_SUBJECT_MAP: Readonly<Record<string, string>> = {
  // canonical short ids
  math: "Mathematics",
  eng: "English",
  chem: "Chemistry",
  phys: "Physics",
  bio: "Biology",
  hist: "History",
  geo: "Geography",
  cs: "Computer Science",
  econ: "Economics",
  // common variants we've seen in older data
  mat: "Mathematics",
  maths: "Mathematics",
  english: "English",
  physics: "Physics",
  phy: "Physics",
  chemistry: "Chemistry",
  biology: "Biology",
  history: "History",
  geography: "Geography",
};

export const FALLBACK_SUBJECTS: { id: string; name: string }[] = [
  { id: "math", name: "Mathematics" },
  { id: "eng", name: "English" },
  { id: "chem", name: "Chemistry" },
  { id: "phys", name: "Physics" },
  { id: "bio", name: "Biology" },
  { id: "hist", name: "History" },
];

/** Title-case a raw id like "computer-science" → "Computer Science" so even
 *  custom ids that aren't in the fallback map render reasonably. */
function titleCase(s: string): string {
  return s
    .replace(/[-_]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Resolve a display-friendly subject name for a classroom. Used at write
 * time (so newly stored classrooms always have a proper name) and at read
 * time (to repair legacy docs).
 *
 * Priority: explicit non-empty subjectName that isn't just the id → Firestore
 * subjects-collection doc name (passed in via subjectNameById) → fallback
 * map → title-cased subjectId.
 */
export function resolveSubjectName(
  subjectId: string,
  subjectName: string | undefined,
  subjectNameById?: Map<string, string>,
): string {
  const id = subjectId?.trim() ?? "";
  const name = subjectName?.trim() ?? "";
  // If the stored name is meaningful (not just the id repeated), trust it.
  if (name && name.toLowerCase() !== id.toLowerCase()) return name;

  if (subjectNameById) {
    const fromDoc = subjectNameById.get(id);
    if (fromDoc) return fromDoc;
  }

  const fromMap = FALLBACK_SUBJECT_MAP[id.toLowerCase()];
  if (fromMap) return fromMap;

  return id ? titleCase(id) : "";
}
