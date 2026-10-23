import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Page } from '@/shared/lib/api-client';
import { camelKeys } from '@/shared/lib/case';
import { flattenPages, wsKey } from '@/shared/lib/query';
import { z } from 'zod';
import {
  approvalRowSchema,
  isTerminal,
  runDetailSchema,
  runRowSchema,
  toApproval,
  toRun,
  type RunDetailRow,
  type RunListParams,
  type RunRow,
  type StartRunInput,
} from './model';

export const runKeys = {
  all: ['runs'] as const,
  list: (p: RunListParams = {}) => ['runs', wsKey(), 'list', p] as const,
  detail: (id: string) => ['runs', wsKey(), 'detail', id] as const,
  approvals: (status?: string) => ['approvals', wsKey(), status ?? 'all'] as const,
  approvalsAll: ['approvals'] as const,
};

export const toRunDetail = (r: RunDetailRow) => camelKeys(r);
export type RunDetail = ReturnType<typeof toRunDetail>;

const listSchema = z.object({ items: z.array(runRowSchema), next_cursor: z.string().nullable(), counts: z.record(z.number()).optional() });

export function useRuns(p: RunListParams = {}) {
  const q = useInfiniteQuery({
    queryKey: runKeys.list(p),
    queryFn: async ({ pageParam }) => listSchema.parse(await api.get('/runs', { query: { ...p, cursor: pageParam ?? undefined, limit: p.limit ?? 20 } })),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_cursor,
  });
  return { ...q, items: flattenPages(q.data).map(toRun), counts: q.data?.pages[0]?.counts ?? {} };
}

export async function fetchRun(id: string) {
  return runDetailSchema.parse(await api.get(`/runs/${id}`));
}

export function useRun(id: string | null | undefined, opts: { refetchWhileActive?: boolean } = {}) {
  return useQuery({
    queryKey: runKeys.detail(id ?? '_'),
    queryFn: () => fetchRun(id!),
    select: toRunDetail,
    enabled: !!id,
    refetchInterval: opts.refetchWhileActive ? (q) => (q.state.data && !isTerminal(q.state.data.status) ? 4000 : false) : false,
  });
}

export function useStartRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: StartRunInput) => api.post<RunRow>('/runs', input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: runKeys.all, refetchType: 'none' });
    },
  });
}

export function useCancelRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<RunRow>(`/runs/${id}/cancel`),
    onMutate: async (id) => {
      const key = runKeys.detail(id);
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<RunDetailRow>(key);
      if (prev) qc.setQueryData<RunDetailRow>(key, { ...prev, status: 'canceled' });
      return { prev, key };
    },
    onError: (_e, _v, ctx) => ctx && qc.setQueryData(ctx.key, ctx.prev),
    onSettled: (_d, _e, id) => {
      void qc.invalidateQueries({ queryKey: runKeys.detail(id) });
      void qc.invalidateQueries({ queryKey: runKeys.all, refetchType: 'none' });
    },
  });
}

export function useApprovals(status: 'pending' | 'approved' | 'rejected' | 'expired' | undefined = 'pending', opts: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: runKeys.approvals(status),
    queryFn: async () => approvalRowSchema.array().parse((await api.get<Page<unknown>>('/approvals', { query: { status } })).items),
    select: (rows) => rows.map(toApproval),
    refetchInterval: 20_000,
    ...opts,
  });
}

export function useDecideApproval() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, approve, comment }: { id: string; approve: boolean; comment?: string; runId?: string }) =>
      api.post(`/approvals/${id}/decision`, { approve, comment }),
    onMutate: async ({ id }) => {
      await qc.cancelQueries({ queryKey: runKeys.approvalsAll });
      const snap = qc.getQueriesData<unknown[]>({ queryKey: runKeys.approvalsAll });
      for (const [k, v] of snap) if (Array.isArray(v)) qc.setQueryData(k, v.filter((a) => (a as { id: string }).id !== id));
      return { snap };
    },
    onError: (_e, _v, ctx) => ctx?.snap.forEach(([k, v]) => qc.setQueryData(k, v)),
    onSettled: (_d, _e, v) => {
      void qc.invalidateQueries({ queryKey: runKeys.approvalsAll });
      if (v.runId) void qc.invalidateQueries({ queryKey: runKeys.detail(v.runId) });
      void qc.invalidateQueries({ queryKey: runKeys.all, refetchType: 'none' });
    },
  });
}
