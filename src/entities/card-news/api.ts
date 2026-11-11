import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/lib/api-client';
import { wsKey } from '@/shared/lib/query';
import { cardNewsInputSchema } from './model';

export const newsEditionSchema = cardNewsInputSchema.extend({
  id: z.string(), edition_date: z.string(), generated_at: z.string().datetime({ offset: true }), model: z.string(),
});
export type NewsEdition = z.infer<typeof newsEditionSchema>;
export const latestNewsSchema = z.object({
  edition: newsEditionSchema.nullable(), status: z.enum(['empty', 'running', 'failed', 'ready']), error: z.string().nullable(),
  schedule: z.string(), scheduler_enabled: z.boolean(),
});
export const stockNewsKey = () => ['stock-news', wsKey()] as const;
export function useLatestStockNews() {
  return useQuery({ queryKey: stockNewsKey(), queryFn: async () => latestNewsSchema.parse(await api.get('/stock-news/latest')),
    staleTime: 15_000, refetchInterval: (query) => query.state.data?.status === 'running' ? 3000 : 30_000 });
}
export function useRefreshStockNews() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: () => api.post('/stock-news/refresh'), onSuccess: () => qc.invalidateQueries({ queryKey: stockNewsKey() }) });
}
