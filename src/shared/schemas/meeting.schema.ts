import { z } from "zod";

export const MeetingCreateSchema = z.object({
  classroomId: z.string().min(1),
  scheduledAt: z.string().optional(),
});

export const MeetingEndSchema = z.object({
  teacherRemarks: z.string().optional(),
  // Legacy alias used by the classroom end-summary modal
  remarks: z.string().optional(),
  issues: z.array(z.string()).optional(),
  impact: z.enum(["low", "med", "high", ""]).optional(),
});

export type MeetingCreateInput = z.infer<typeof MeetingCreateSchema>;
export type MeetingEndInput = z.infer<typeof MeetingEndSchema>;
