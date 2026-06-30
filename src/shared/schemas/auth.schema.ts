import { z } from "zod";

export const SessionRequestSchema = z.object({
  idToken: z.string().min(1, "ID token is required"),
  role: z.enum(["teacher", "student"]).optional(),
  /** Student-only personalization captured at signup. */
  grade: z.number().int().min(1).max(12).optional(),
  syllabus: z.string().trim().max(120).optional(),
});

export const RoleAssignSchema = z.object({
  uid: z.string().min(1),
  role: z.enum(["teacher", "student", "parent", "admin"]),
});

export type SessionRequestInput = z.infer<typeof SessionRequestSchema>;
export type RoleAssignInput = z.infer<typeof RoleAssignSchema>;
