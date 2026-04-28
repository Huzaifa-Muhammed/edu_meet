import { z } from "zod";

export const AssessmentCreateSchema = z.object({
  classroomId: z.string().min(1),
  title: z.string().min(1).max(200),
  instructions: z.string().max(2000).optional(),
  dueAt: z.string().optional(),
  totalPoints: z.number().int().min(0).optional(),
});

export const AssessmentUpdateSchema = AssessmentCreateSchema.partial();

export const AssessmentQuestionSchema = z.object({
  type: z.enum(["mcq", "short", "tf"]),
  text: z.string().min(1),
  options: z.array(z.string()).optional(),
  correctIndex: z.number().int().min(0).optional(),
  correctText: z.string().optional(),
  correctBool: z.boolean().optional(),
  points: z.number().int().min(0),
  order: z.number().int().min(0),
});

export const AssessmentSubmitSchema = z.object({
  answers: z.array(
    z.object({
      questionId: z.string().min(1),
      value: z.union([z.string(), z.number(), z.boolean()]),
    }),
  ),
});

export const AssessmentGradeSchema = z.object({
  uid: z.string().min(1),
  perQuestionScores: z.array(
    z.object({
      questionId: z.string().min(1),
      score: z.number().min(0),
    }),
  ),
  feedback: z.string().optional(),
});

export const GenerateAssessmentSchema = z.object({
  subject: z.string().min(1),
  grade: z.number().int().min(1).max(12),
  topic: z.string().min(1),
  type: z.enum(["mcq", "short", "tf"]),
  count: z.number().int().min(1).max(20),
});

export type AssessmentCreateInput = z.infer<typeof AssessmentCreateSchema>;
export type AssessmentQuestionInput = z.infer<typeof AssessmentQuestionSchema>;
export type AssessmentSubmitInput = z.infer<typeof AssessmentSubmitSchema>;
export type AssessmentGradeInput = z.infer<typeof AssessmentGradeSchema>;
export type GenerateAssessmentInput = z.infer<typeof GenerateAssessmentSchema>;
