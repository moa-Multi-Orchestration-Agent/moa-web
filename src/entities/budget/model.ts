import { z } from 'zod';

/** budgets (design.md 2.5.2) */
export const budgetRowSchema = z
  .object({
    id: z.string(),
    workspace_id: z.string(),
    scope_type: z.enum(['workspace', 'agent', 'endpoint']),
    scope_id: z.string(),
    monthly_limit_usd: z.number().nullable(),
    per_run_limit_usd: z.number().nullable(),
    alert_ratio: z.number(),
    /** 표시용 확장: 이번 달 사용액, 대상 이름 */
    spent_usd: z.number(),
    scope_name: z.string(),
  })
  ;
export type BudgetRow = z.infer<typeof budgetRowSchema>;

export const budgetFormSchema = z.object({
  monthly_limit_usd: z.number().min(0, '0 이상'),
  per_run_limit_usd: z.number().min(0, '0 이상'),
  alert_ratio: z.number().min(0.1).max(1),
});
export type BudgetForm = z.infer<typeof budgetFormSchema>;
