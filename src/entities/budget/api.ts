import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Page } from '@/shared/lib/api-client';
import { wsKey } from '@/shared/lib/query';
import { budgetRowSchema, type BudgetRow } from './model';

export const budgetKeys = { all: ['budgets'] as const, list: () => ['budgets', wsKey()] as const };

export function useBudgets() {
  return useQuery({ queryKey: budgetKeys.list(), queryFn: async () => budgetRowSchema.array().parse((await api.get<Page<unknown>>('/budgets')).items) });
}

export function useSetBudget() {
  const qc = useQueryClient();
  const key = budgetKeys.list();
  return useMutation({
    mutationFn: (input: Pick<BudgetRow, 'scope_type' | 'scope_id' | 'monthly_limit_usd' | 'per_run_limit_usd' | 'alert_ratio'>) => api.put<BudgetRow>('/budgets', input),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<BudgetRow[]>(key);
      qc.setQueryData<BudgetRow[]>(key, (rows) => rows?.map((b) => (b.scope_type === input.scope_type && b.scope_id === input.scope_id ? { ...b, ...input } : b)));
      return { prev };
    },
    onError: (_e, _v, ctx) => qc.setQueryData(key, ctx?.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: budgetKeys.all }),
  });
}
