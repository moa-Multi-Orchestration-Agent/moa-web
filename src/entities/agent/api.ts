import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Page } from '@/shared/lib/api-client';
import { camelKeys } from '@/shared/lib/case';
import { flattenPages, patchEverywhere, restore, wsKey } from '@/shared/lib/query';
import { agentDetailSchema, agentRowSchema, toAgent, type AgentDetailRow, type AgentForm, type AgentRow } from './model';

export interface AgentListParams {
  q?: string;
  filter?: 'all' | 'deployed' | 'draft' | 'listed' | 'purchased';
  sort?: 'updated' | 'name' | 'runs';
  limit?: number;
}

export const agentKeys = {
  all: ['agents'] as const,
  list: (p: AgentListParams = {}) => ['agents', wsKey(), 'list', p] as const,
  detail: (id: string) => ['agents', wsKey(), 'detail', id] as const,
};

export const toAgentDetail = (r: AgentDetailRow) => camelKeys(r);
export type AgentDetail = ReturnType<typeof toAgentDetail>;

export async function fetchAgents(p: AgentListParams & { cursor?: string | null }) {
  const r = await api.get<Page<unknown>>('/agents', { query: { ...p, cursor: p.cursor ?? undefined, limit: p.limit ?? 12 } });
  return { items: agentRowSchema.array().parse(r.items), next_cursor: r.next_cursor, total: r.total };
}

export function useAgents(p: AgentListParams = {}) {
  const q = useInfiniteQuery({
    queryKey: agentKeys.list(p),
    queryFn: ({ pageParam }) => fetchAgents({ ...p, cursor: pageParam }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_cursor,
  });
  return { ...q, items: flattenPages(q.data).map(toAgent), total: q.data?.pages[0]?.total ?? null };
}

export function useAgent(id: string | null | undefined) {
  return useQuery({
    queryKey: agentKeys.detail(id ?? '_'),
    queryFn: async () => agentDetailSchema.parse(await api.get(`/agents/${id}`)),
    select: toAgentDetail,
    enabled: !!id,
  });
}

export function useCreateAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<AgentForm> & { name: string; primary_workflow_id?: string | null }) => api.post<AgentDetailRow>('/agents', input),
    onSuccess: (row) => {
      qc.setQueryData(agentKeys.detail(row.id), row);
      void qc.invalidateQueries({ queryKey: agentKeys.all });
    },
  });
}

/** 낙관적 수정: 목록·상세 캐시를 먼저 바꾸고 실패하면 되돌린다 */
export function useUpdateAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: Partial<AgentForm> & { id: string; primary_workflow_id?: string | null }) => api.patch<AgentDetailRow>(`/agents/${id}`, patch),
    onMutate: async ({ id, ...patch }) => {
      await qc.cancelQueries({ queryKey: agentKeys.all });
      const snap = patchEverywhere<AgentRow>(qc, agentKeys.all, id, (a) => ({ ...a, ...patch }));
      return { snap };
    },
    onError: (_e, _v, ctx) => restore(qc, ctx?.snap),
    onSuccess: (row) => qc.setQueryData(agentKeys.detail(row.id), row),
    onSettled: () => qc.invalidateQueries({ queryKey: agentKeys.all }),
  });
}

export function useDeleteAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/agents/${id}`),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: agentKeys.all });
      const snap = patchEverywhere<AgentRow>(qc, agentKeys.all, id, () => null);
      return { snap };
    },
    onError: (_e, _v, ctx) => restore(qc, ctx?.snap),
    onSettled: () => qc.invalidateQueries({ queryKey: agentKeys.all }),
  });
}

export function useDuplicateAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<AgentDetailRow>(`/agents/${id}/duplicate`),
    onSuccess: () => qc.invalidateQueries({ queryKey: agentKeys.all }),
  });
}

function useAgentDetailMutation<V>(agentId: string, fn: (v: V) => Promise<AgentDetailRow>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (row) => {
      qc.setQueryData(agentKeys.detail(agentId), row);
      void qc.invalidateQueries({ queryKey: agentKeys.all, refetchType: 'none' });
    },
  });
}

export function useAddSkill(agentId: string) {
  return useAgentDetailMutation(agentId, (v: { mcp_tool_id?: string; builtin_skill?: string; require_approval?: boolean }) => api.post<AgentDetailRow>(`/agents/${agentId}/skills`, v));
}

export function useUpdateSkill(agentId: string) {
  const qc = useQueryClient();
  const key = agentKeys.detail(agentId);
  return useMutation({
    mutationFn: ({ skillId, ...patch }: { skillId: string; require_approval?: boolean; config?: Record<string, unknown> }) => api.patch<AgentDetailRow>(`/agents/${agentId}/skills/${skillId}`, patch),
    onMutate: async ({ skillId, ...patch }) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<AgentDetailRow>(key);
      if (prev) qc.setQueryData<AgentDetailRow>(key, { ...prev, skills: prev.skills.map((s) => (s.id === skillId ? { ...s, ...patch, config: { ...s.config, ...patch.config } } : s)) });
      return { prev };
    },
    onError: (_e, _v, ctx) => qc.setQueryData(key, ctx?.prev),
    onSuccess: (row) => qc.setQueryData(key, row),
  });
}

export function useRemoveSkill(agentId: string) {
  return useAgentDetailMutation(agentId, (skillId: string) => api.delete<AgentDetailRow>(`/agents/${agentId}/skills/${skillId}`));
}

export function useSetAgentWorkflows(agentId: string) {
  return useAgentDetailMutation(agentId, (items: { workflow_id: string; alias: string }[]) => api.put<AgentDetailRow>(`/agents/${agentId}/workflows`, { items }));
}
