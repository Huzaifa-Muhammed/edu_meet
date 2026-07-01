import { z } from "zod";

export const UserUpdateSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  bio: z.string().max(500).optional(),
  subjects: z.array(z.string()).optional(),
  photoUrl: z.string().url().optional(),
  grade: z.number().int().min(1).max(12).optional(),
  syllabus: z.string().trim().max(120).optional(),
  /** Teacher-only: grade levels + exam boards they teach. Captured at
   * application time; editable from the teacher profile afterwards. */
  applicationGrades: z.array(z.number().int().min(1).max(12)).max(12).optional(),
  applicationSyllabi: z.array(z.string().trim().max(120)).max(20).optional(),
});

export const UserCreateSchema = z.object({
  uid: z.string().min(1),
  email: z.string().email(),
  displayName: z.string().min(1).max(100),
  role: z.enum(["teacher", "student", "parent", "admin"]),
  photoUrl: z.string().url().optional(),
});

export type UserUpdateInput = z.infer<typeof UserUpdateSchema>;
export type UserCreateInput = z.infer<typeof UserCreateSchema>;
