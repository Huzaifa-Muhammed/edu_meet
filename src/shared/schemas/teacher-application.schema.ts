import { z } from "zod";

const CredentialImage = z.object({
  url: z.string().url(),
  publicId: z.string().min(1),
});

export const TeacherExperienceSchema = z.object({
  title: z.string().min(2).max(120),
  organization: z.string().min(2).max(120),
  years: z.string().max(40).optional().or(z.literal("")),
  description: z.string().max(400).optional().or(z.literal("")),
  image: CredentialImage.optional(),
});

export const TeacherCertificationSchema = z.object({
  title: z.string().min(2).max(120),
  issuer: z.string().min(2).max(120),
  year: z.string().max(20).optional().or(z.literal("")),
  image: CredentialImage.optional(),
});

export const TeacherDegreeSchema = z.object({
  title: z.string().min(2).max(120),
  institution: z.string().min(2).max(120),
  year: z.string().max(20).optional().or(z.literal("")),
  image: CredentialImage.optional(),
});

export const TeacherApplicationCreateSchema = z.object({
  subject: z.string().min(2).max(60),
  yearsExperience: z.number().int().min(0).max(60),
  highestDegree: z.string().min(2).max(120),
  bio: z.string().max(600).optional(),
  experiences: z.array(TeacherExperienceSchema).max(20).optional(),
  certifications: z.array(TeacherCertificationSchema).max(20).optional(),
  degrees: z.array(TeacherDegreeSchema).max(20).optional(),
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
export type TeacherExperience = z.infer<typeof TeacherExperienceSchema>;
export type TeacherCertification = z.infer<typeof TeacherCertificationSchema>;
export type TeacherDegree = z.infer<typeof TeacherDegreeSchema>;
