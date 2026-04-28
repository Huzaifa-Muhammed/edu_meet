import { z } from "zod";

export const ClassroomCreateSchema = z.object({
  subjectId: z.string().min(1),
  subjectName: z.string().min(1).max(100).optional(),
  grade: z.number().int().min(1).max(12),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
});

export const ClassroomUpdateSchema = ClassroomCreateSchema.partial();

export const EnrollSchema = z.object({
  code: z.string().min(1, "Class code is required"),
});

export type ClassroomCreateInput = z.infer<typeof ClassroomCreateSchema>;
export type ClassroomUpdateInput = z.infer<typeof ClassroomUpdateSchema>;
export type EnrollInput = z.infer<typeof EnrollSchema>;
