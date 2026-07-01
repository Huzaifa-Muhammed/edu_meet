import type {
  UserRole,
  MeetingStatus,
  AssessmentStatus,
  AssessmentQuestionType,
  SubmissionStatus,
  MediaCategory,
  ResourceType,
  AttendanceEventType,
  InsightKind,
  NoteTag,
  QuizDifficulty,
} from "./enums";

/* ── Credentials (shared by application + user profile) ── */
export interface CredentialImage {
  url: string;
  publicId: string;
}

export interface TeacherExperienceEntry {
  title: string;
  organization: string;
  years?: string;
  description?: string;
  image?: CredentialImage;
}

export interface TeacherCertificationEntry {
  title: string;
  issuer: string;
  year?: string;
  image?: CredentialImage;
}

export interface TeacherDegreeEntry {
  title: string;
  institution: string;
  year?: string;
  image?: CredentialImage;
}

/* ── Users ──
 * Teacher application data lives directly on the user doc. The admin
 * "applications" list is just `users where role==teacher` filtered by
 * `applicationStatus`. There is no separate teacherApplications collection
 * in the current data model. */
export interface User {
  uid: string;
  role: UserRole;
  email: string;
  /** Canonical display name. Legacy/externally-created docs may also have
   * `name` — readers should prefer `displayName ?? name`, and the auth/
   * application flows mirror them so both stay populated. */
  displayName: string;
  name?: string;
  photoUrl?: string;
  bio?: string;
  subjects?: string[];
  linkedStudents?: string[];
  blocked?: boolean;
  blockedAt?: string;
  blockReason?: string;

  /* Teacher application fields — only meaningful when role === "teacher".
   * `status` is the canonical field; `applicationStatus` is its mirror for
   * back-compat with older code paths. Readers should accept either. */
  status?: "none" | "pending" | "approved" | "rejected";
  applicationStatus?: "none" | "pending" | "approved" | "rejected";
  applicationSubject?: string;
  /** Grade levels (1–12) the teacher can teach. */
  applicationGrades?: number[];
  /** Exam boards / syllabi the teacher can teach (e.g. Edexcel, AQA). */
  applicationSyllabi?: string[];
  applicationYearsExperience?: number;
  applicationHighestDegree?: string;
  /** Student-only: grade level (1–12) + exam board, captured at signup,
   * editable in the student profile. */
  grade?: number;
  syllabus?: string;
  applicationSubmittedAt?: string;
  applicationReviewedAt?: string;
  applicationReviewedBy?: string;
  applicationReviewNote?: string;
  experiences?: TeacherExperienceEntry[];
  certifications?: TeacherCertificationEntry[];
  degrees?: TeacherDegreeEntry[];

  createdAt: string;
  updatedAt: string;
}

/* ── Teacher application (view type) ──
 * Assembled from a User doc on read so admin pages + email templates can
 * keep their existing field names. `id` === `uid`. */
export interface TeacherApplication {
  id: string;
  uid: string;
  email: string;
  displayName: string;
  subject: string;
  grades?: number[];
  syllabi?: string[];
  yearsExperience: number;
  highestDegree: string;
  bio?: string;
  experiences?: TeacherExperienceEntry[];
  certifications?: TeacherCertificationEntry[];
  degrees?: TeacherDegreeEntry[];
  status: "pending" | "approved" | "rejected";
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  reviewNote?: string;
}

/* ── Subjects ── */
export interface Subject {
  id: string;
  name: string;
  gradeLevels: number[];
}

/* ── Classrooms ── */
export interface Classroom {
  id: string;
  teacherId: string;
  subjectId: string;
  subjectName?: string;
  grade: number;
  /** Exam board / syllabus this class follows (e.g. Edexcel, AQA). */
  syllabus?: string;
  name: string;
  description?: string;
  code: string;
  studentIds: string[];
  createdAt: string;
}

/* ── Agendas ── */
export interface AgendaSubtopic {
  id: string;
  title: string;
  status: "pending" | "done";
}

export interface AgendaTopic {
  id: string;
  title: string;
  status: "pending" | "in_progress" | "done";
  subtopics: AgendaSubtopic[];
}

export interface Agenda {
  id: string;
  subjectId: string;
  grade: number;
  title: string;
  ownerScope: "system" | "teacher";
  topics: AgendaTopic[];
}

export interface ClassroomAgenda {
  classroomId: string;
  sourceAgendaId: string;
  overrides?: Record<string, unknown>;
  currentTopicId?: string;
  currentSubId?: string;
}

/* ── Notes ── */
export interface Note {
  id: string;
  ownerScope: "system" | "teacher";
  ownerId: string;
  agendaId?: string;
  topicId?: string;
  meetingId?: string;
  tag: NoteTag;
  body: string;
  codeSnippet?: string;
  createdAt: string;
}

/* ── Resources ── */
export interface Resource {
  id: string;
  ownerScope: "system" | "teacher";
  ownerId: string;
  subjectId: string;
  grade: number;
  type: ResourceType;
  title: string;
  subtitle?: string;
  mediaId?: string;
  url?: string;
  icon?: string;
  createdAt: string;
}

/* ── Meetings ── */
export interface Meeting {
  id: string;
  classroomId: string;
  teacherId: string;
  videosdkRoomId?: string;
  status: MeetingStatus;
  startedAt?: string;
  endedAt?: string;
  recordingUrl?: string;
  currentSlide?: number;
  participantIds: string[];
  /* ── Scheduling (set on AI-generated + scheduled meetings) ──
   * Explicit wall-clock strings are timezone-stable for display, unlike
   * deriving from `startedAt`. `startedAt` is still populated (derived from
   * these) so existing ordering/date-grouping keeps working. */
  scheduledDate?: string; // "YYYY-MM-DD" (local wall date)
  scheduledTime?: string; // "HH:MM" 24h (local wall time)
  durationMin?: number;
  subjectName?: string;
  /** Exam board / syllabus + grade this class follows — copied from the
   * classroom when the meeting is (AI-)scheduled so the schedule can display
   * and match on them without a second classroom read. */
  syllabus?: string;
  grade?: number;
  title?: string;
  source?: "manual" | "ai";
  /** AI proposals start as "proposed" (teacher-only); approval flips to
   * "approved" (visible on dashboard + to students). Absent = approved
   * (manual/legacy meetings). */
  scheduleStatus?: "proposed" | "approved";
  /** Set when a proposed meeting is approved — drives the student "new
   * schedule ready" dashboard popup. */
  approvedAt?: string;
  /** Substitute cover (admin reassigns when a teacher is on emergency leave). */
  originalTeacherId?: string;
  substituteTeacherId?: string;
  reassignedAt?: string;
  reassignedBy?: string;
}

/* ── Teacher availability (for AI scheduling) ── */
export interface AvailabilityBlock {
  /** Day of week, Monday = 0 … Sunday = 6 */
  day: number;
  /** "HH:MM" 24h — start of the unavailable window (inclusive) */
  start: string;
  /** "HH:MM" 24h — end of the unavailable window (exclusive) */
  end: string;
}

export interface TeacherAvailability {
  teacherId: string;
  timezone?: string;
  /** Windows the teacher is NOT available. Default = fully available. */
  blocks: AvailabilityBlock[];
  updatedAt?: string;
}

/* ── Teacher leave requests ── */
export interface LeaveRequest {
  id: string;
  teacherId: string;
  teacherName: string;
  teacherEmail?: string;
  startDate: string; // "YYYY-MM-DD"
  endDate: string; // "YYYY-MM-DD" (== startDate for a single day)
  reason: string;
  /** Auto-flagged true when the leave starts within ~48h, or set by the teacher. */
  emergency?: boolean;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
  reviewNote?: string | null;
}

/* ── Cover requests (AI substitute marketplace) ──
 * When an approved leave knocks out a class, the system broadcasts a
 * "take this class" request to every other approved same-subject teacher.
 * First acceptor auto-wins (instant cover); a later acceptor flips the
 * request to "contested" so an admin picks the substitute. */
export interface CoverAcceptance {
  teacherId: string;
  teacherName: string;
  acceptedAt: string;
}

export interface CoverRequest {
  id: string;
  meetingId: string;
  leaveId: string;
  originalTeacherId: string;
  originalTeacherName: string;
  subjectName: string;
  classTitle: string;
  scheduledDate: string; // "YYYY-MM-DD"
  scheduledTime: string; // "HH:MM"
  durationMin: number;
  /** open = awaiting a taker · assigned = covered · contested = >1 taker,
   *  admin must choose · cancelled = no longer needed. */
  status: "open" | "assigned" | "contested" | "cancelled";
  acceptances: CoverAcceptance[];
  assignedTeacherId: string | null;
  assignedTeacherName: string | null;
  resolvedAt: string | null;
  /** admin uid that resolved a contest, or "auto" for first-accept wins. */
  resolvedBy: string | null;
  createdAt: string;
}

/* ── Media ── */
export interface Media {
  id: string;
  ownerId: string;
  providerId: string;
  url: string;
  type: string;
  sizeBytes: number;
  category: MediaCategory;
}

/* ── Live Quizzes ── */
export interface Quiz {
  id: string;
  classroomId: string;
  subjectId: string;
  text: string;
  codeSnippet?: string;
  options: string[];
  correctIndex: number;
  difficulty: QuizDifficulty;
  createdBy: string;
  createdAt: string;
}

export interface QuizSession {
  meetingId: string;
  qid: string;
  status: "posted" | "closed";
  postedAt: string;
  closedAt?: string;
  stats?: Record<string, number>;
}

export interface QuizResponse {
  meetingId: string;
  qid: string;
  uid: string;
  answerIndex: number;
  correct: boolean;
  respondedAt: string;
  timeMs: number;
}

/* ── Assessments ── */
export interface Assessment {
  id: string;
  classroomId: string;
  teacherId: string;
  title: string;
  instructions?: string;
  dueAt?: string;
  totalPoints: number;
  status: AssessmentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AssessmentQuestion {
  id: string;
  assessmentId: string;
  type: AssessmentQuestionType;
  text: string;
  options?: string[];
  correctIndex?: number;
  correctText?: string;
  correctBool?: boolean;
  points: number;
  order: number;
}

export interface AssessmentSubmission {
  assessmentId: string;
  uid: string;
  answers: { questionId: string; value: string | number | boolean }[];
  submittedAt: string;
  autoScore: number;
  manualScore?: number;
  finalScore?: number;
  status: SubmissionStatus;
  gradedBy?: string;
  gradedAt?: string;
  feedback?: string;
}

/* ── Attendance ── */
export interface AttendanceEvent {
  id: string;
  meetingId: string;
  uid: string;
  type: AttendanceEventType;
  ts: string;
}

/* ── Breakouts ── */
export interface BreakoutRoom {
  id: string;
  meetingId: string;
  name: string;
  studentIds: string[];
  videosdkRoomId?: string;
  timerEndsAt?: string;
}

/* ── Chat ── */
export interface ChatMessage {
  id: string;
  meetingId: string;
  fromUid: string;
  toUid?: string; // null = class-wide
  body: string;
  ts: string;
}

/* ── Insights ── */
export interface InsightCard {
  id: string;
  meetingId: string;
  kind: InsightKind;
  icon: string;
  title: string;
  text: string;
  time: string;
  actions: { label: string; actionKey: string }[];
  dismissed: boolean;
  generatedBy: string;
}

/* ── Summaries ── */
export interface Summary {
  meetingId: string;
  kpis: Record<string, number | string>;
  comprehension?: number;
  followUps: string[];
  topicAnalysis: { topicId: string; coverage: number; notes: string }[];
  studentQuestions: string[];
  sessionIssues: { flags: string[]; impact: string; notes: string };
  teacherRemarks?: string;
  status: "draft" | "submitted";
  submittedAt?: string;
  pdfMediaId?: string;
}

/* ── Payments ── */
export interface Payment {
  id: string;
  userId: string;
  stripeCustomerId: string;
  stripeSessionId: string;
  status: string;
  amount: number;
  currency: string;
  createdAt: string;
}

/* ── AI Interactions ── */
export interface AIInteraction {
  id: string;
  userId: string;
  provider: string;
  prompt: string;
  response: string;
  useCase: string;
  createdAt: string;
}
