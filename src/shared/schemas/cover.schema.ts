import { z } from "zod";

/** Admin resolves a contested cover request by choosing one of the
 *  teachers who accepted it. */
export const CoverResolveSchema = z.object({
  teacherId: z.string().min(1, "Pick a teacher"),
});

export type CoverResolveInput = z.infer<typeof CoverResolveSchema>;
