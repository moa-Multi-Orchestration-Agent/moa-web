import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/lib/api-client';
import { wsKey } from '@/shared/lib/query';
import { usageResponseSchema, type UsageGroupBy } from './model';

export function useUsage(p: { from?: string; to?: string; group_by: UsageGroupBy }) {
  return useQuery({
    queryKey: ['usage', wsKey(), p],
    queryFn: async () => usageResponseSchema.parse(await api.get('/usage', { query: { ...p } })),
  });
}

/** 이번 달 1일 0시 */
export function monthStartIso() {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}
