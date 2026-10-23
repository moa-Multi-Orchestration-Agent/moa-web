import { z } from 'zod';

export const usageRowSchema = z.object({
  key: z.string(),
  label: z.string(),
  cost_usd: z.number(),
  tokens_in: z.number(),
  tokens_out: z.number(),
  runs: z.number(),
});
export type UsageRow = z.infer<typeof usageRowSchema>;

export const usageResponseSchema = z.object({
  from: z.string(),
  to: z.string(),
  group_by: z.string(),
  items: z.array(usageRowSchema),
  total: usageRowSchema.omit({ key: true, label: true }),
});
export type UsageResponse = z.infer<typeof usageResponseSchema>;

export type UsageGroupBy = 'day' | 'model' | 'agent' | 'endpoint';
