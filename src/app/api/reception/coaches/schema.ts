import { z } from "zod";

export const CoachSchema = z.object({
  name: z.string().trim().min(2).max(80),
  bio: z.string().trim().max(600).optional().nullable(),
  rate_individual: z.number().positive().max(10000),
  rate_pair: z.number().positive().max(10000).optional().nullable(),
  active: z.boolean(),
  weekly_hours: z
    .array(z.object({ dow: z.number().int().min(0).max(6), start: z.string(), end: z.string() }))
    .max(28),
});
