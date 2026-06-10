import { z } from "zod";

const YMD = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export const LeaveCreateSchema = z
  .object({
    startDate: z.string().regex(YMD, "Expected YYYY-MM-DD"),
    endDate: z.string().regex(YMD, "Expected YYYY-MM-DD").optional(),
    reason: z.string().trim().min(3, "Please give a reason").max(1000),
  })
  .refine((v) => !v.endDate || v.endDate >= v.startDate, {
    message: "End date can't be before start date",
    path: ["endDate"],
  });

export const LeaveReviewSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  reviewNote: z.string().trim().max(1000).optional(),
});

export type LeaveCreateInput = z.infer<typeof LeaveCreateSchema>;
export type LeaveReviewInput = z.infer<typeof LeaveReviewSchema>;
