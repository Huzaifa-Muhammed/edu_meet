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

/* ── Users ── */
export interface User {
  uid: string;
  role: UserRole;
  email: string;
  displayName: string;
  photoUrl?: string;
  bio?: string;
  subjects?: string[];
  linkedStudents?: string[];
  blocked?: boolean;
  blockedAt?: string;
  blockReason?: string;
  applicationStatus?: "none" | "pending" | "approved" | "rejected";
  experiences?: TeacherExperienceEntry[];
  certifications?: TeacherCertificationEntry[];
  degrees?: TeacherDegreeEntry[];
  createdAt: string;
  updatedAt: string;
}

/* ── Teacher applications ── */
export interface TeacherApplication {
  id: string;
  uid: string;
  email: string;
  displayName: string;
  subject: string;
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
  grade: number;
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
