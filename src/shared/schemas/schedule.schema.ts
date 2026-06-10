import { z } from "zod";

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;
const YMD = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export const AvailabilityBlockSchema = z.object({
  day: z.number().int().min(0).max(6),
  start: z.string().regex(HHMM, "Expected HH:MM"),
  end: z.string().regex(HHMM, "Expected HH:MM"),
});

export const AvailabilitySaveSchema = z.object({
  timezone: z.string().max(64).optional(),
  blocks: z.array(AvailabilityBlockSchema).max(300),
});

/** Monday of the target week, "YYYY-MM-DD". Optional — server picks the
 *  soonest empty upcoming week when omitted. */
const WeekStartSchema = z.string().regex(YMD, "Expected YYYY-MM-DD");

export const ScheduleGenerateSchema = z.object({
  weekStart: WeekStartSchema.optional(),
  sessionsPerWeek: z.number().int().min(1).max(5).optional(),
});

export const ScheduleApproveSchema = z.object({
  weekStart: WeekStartSchema.optional(),
});

export const ScheduleDiscardSchema = z.object({
  weekStart: WeekStartSchema.optional(),
});

export type AvailabilityBlockInput = z.infer<typeof AvailabilityBlockSchema>;
export type AvailabilitySaveInput = z.infer<typeof AvailabilitySaveSchema>;
export type ScheduleGenerateInput = z.infer<typeof ScheduleGenerateSchema>;
