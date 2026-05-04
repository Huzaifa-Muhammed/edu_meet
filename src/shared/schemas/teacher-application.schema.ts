import { z } from "zod";

export const TeacherApplicationCreateSchema = z.object({
  subject: z.string().min(2).max(60),
  yearsExperience: z.number().int().min(0).max(60),
  highestDegree: z.string().min(2).max(120),
  bio: z.string().max(600).optional(),
});

export const TeacherApplicationReviewSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  reviewNote: z.string().max(400).optional(),
});

export type TeacherApplicationCreateInput = z.infer<
  typeof TeacherApplicationCreateSchema
>;
export type TeacherApplicationReviewInput = z.infer<
  typeof TeacherApplicationReviewSchema
>;
