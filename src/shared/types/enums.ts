export enum UserRole {
  TEACHER = "teacher",
  STUDENT = "student",
  PARENT = "parent",
  ADMIN = "admin",
}

export enum MeetingStatus {
  SCHEDULED = "scheduled",
  LIVE = "live",
  ENDED = "ended",
}

export enum AssessmentStatus {
  DRAFT = "draft",
  ASSIGNED = "assigned",
  CLOSED = "closed",
}

export enum AssessmentQuestionType {
  MCQ = "mcq",
  SHORT = "short",
  TRUE_FALSE = "tf",
}

export enum SubmissionStatus {
  SUBMITTED = "submitted",
  GRADED = "graded",
}

export enum MediaCategory {
  SLIDE_DECK = "slide_deck",
  VIDEO = "video",
  PDF = "pdf",
  IMAGE = "image",
  LINK = "link",
}

export enum ResourceType {
  TOOL = "tool",
  DOC = "doc",
  LINK = "link",
}

export enum AttendanceEventType {
  JOIN = "join",
  LEAVE = "leave",
  HAND = "hand",
  MIC = "mic",
  AWAY = "away",
  ATTENTIVE = "attentive",
}

export enum InsightKind {
  LIVE_INSIGHT = "live_insight",
  TREND = "trend",
}

export enum NoteTag {
  CONCEPT = "concept",
  EXAMPLE = "example",
  IMPORTANT = "important",
  QUESTION = "question",
  TODO = "todo",
}

export enum QuizDifficulty {
  EASY = "easy",
  MEDIUM = "medium",
  HARD = "hard",
}
