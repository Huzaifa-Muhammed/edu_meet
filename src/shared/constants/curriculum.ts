/**
 * Curriculum constants — exam boards ("syllabus") and grade/board matching.
 *
 * In this product "syllabus" means the exam board (Edexcel, AQA, Cambridge…).
 * Course-content rows uploaded by admins carry a free-text grade + board per
 * topic; teachers/students/classrooms now also carry a board so the live-class
 * "Import content" list can be filtered to what's actually relevant.
 *
 * Grades stay numeric 1–12 across the app; the matchers normalise the free-text
 * grades that appear in the Excel ("Grade 9", "9", "Year 10") back to a number.
 */
export const SYLLABI: { id: string; name: string }[] = [
  { id: "edexcel", name: "Edexcel (Pearson)" },
  { id: "aqa", name: "AQA" },
  { id: "cambridge", name: "Cambridge (CIE / IGCSE)" },
  { id: "ocr", name: "OCR" },
  { id: "wjec", name: "WJEC / Eduqas" },
  { id: "ib", name: "IB" },
];

/** Grade levels 1..12. */
export const GRADES: number[] = Array.from({ length: 12 }, (_, i) => i + 1);

export const normSyllabus = (s?: string): string => (s ?? "").trim().toLowerCase();

/**
 * True when a free-text item board matches the class board. A blank item board
 * is treated as a wildcard (unlabeled content is always eligible), as is a blank
 * class board (a class with no board sees everything).
 */
export function syllabusMatches(classBoard?: string, itemBoard?: string): boolean {
  const item = normSyllabus(itemBoard);
  if (!item) return true;
  const cls = normSyllabus(classBoard);
  if (!cls) return true;
  return cls === item || item.includes(cls) || cls.includes(item);
}

/**
 * True when a free-text item grade matches the class grade. Parses the first
 * integer out of strings like "Grade 9" / "9" / "Year 10"; a blank/non-numeric
 * item grade (or a missing class grade) is a wildcard.
 */
export function gradeMatches(classGrade?: number, itemGrade?: string): boolean {
  if (!itemGrade?.trim()) return true;
  if (!classGrade) return true;
  const n = parseInt(itemGrade.replace(/[^0-9]/g, ""), 10);
  return Number.isNaN(n) ? true : n === classGrade;
}
