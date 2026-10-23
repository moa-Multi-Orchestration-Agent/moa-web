import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Page } from '@/shared/lib/api-client';
import { wsKey } from '@/shared/lib/query';
import { contextBlockRowSchema, contextSessionRowSchema, snapshotRowSchema, type BlockPatch, type ContextBlockRow, type SnapshotRow } from './model';

export const contextKeys = {
  all: ['context'] as const,
  session: (id: string) => ['context', wsKey(), 'session', id] as const,
  blocks: (id: string) => ['context', wsKey(), 'blocks', id] as const,
  snapshots: (id: string) => ['context', wsKey(), 'snapshots', id] as const,
};

export function useAgentSessions(agentId: string | null | undefined) {
  return useQuery({
    queryKey: ['context', wsKey(), 'sessions', agentId ?? '_'],
    queryFn: async () => contextSessionRowSchema.array().parse((await api.get<Page<unknown>>('/context/sessions', { query: { agent_id: agentId ?? undefined } })).items),
    enabled: !!agentId,
  });
}

export function useContextSession(id: string | null | undefined) {
  return useQuery({
    queryKey: contextKeys.session(id ?? '_'),
    queryFn: async () => contextSessionRowSchema.parse(await api.get(`/context/sessions/${id}`)),
    enabled: !!id,
  });
}

export function useContextBlocks(sessionId: string | null | undefined) {
  return useQuery({
    queryKey: contextKeys.blocks(sessionId ?? '_'),
    queryFn: async () => contextBlockRowSchema.array().parse((await api.get<Page<unknown>>(`/context/sessions/${sessionId}/blocks`, { query: { include_disabled: true } })).items),
    enabled: !!sessionId,
  });
}

/** 블록 고정·끄기·우선순위 (PATCH + If-Match). 낙관적 수정, 409면 되돌리고 최신본을 다시 불러온다. */
export function usePatchBlock(sessionId: string) {
  const qc = useQueryClient();
  const key = contextKeys.blocks(sessionId);
  return useMutation({
    mutationFn: ({ block, patch }: { block: ContextBlockRow; patch: BlockPatch }) => api.patch<ContextBlockRow>(`/context/blocks/${block.id}`, patch, { ifMatch: block.version }),
    onMutate: async ({ block, patch }) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<ContextBlockRow[]>(key);
      qc.setQueryData<ContextBlockRow[]>(key, (rows) => rows?.map((b) => (b.id === block.id ? { ...b, ...patch, version: b.version + 1 } : b)));
      return { prev };
    },
    onError: (_e, _v, ctx) => qc.setQueryData(key, ctx?.prev),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: key });
      void qc.invalidateQueries({ queryKey: contextKeys.session(sessionId) });
    },
  });
}

export function useSnapshots(sessionId: string | null | undefined) {
  return useQuery({
    queryKey: contextKeys.snapshots(sessionId ?? '_'),
    queryFn: async () => snapshotRowSchema.array().parse((await api.get<Page<unknown>>(`/context/sessions/${sessionId}/snapshots`)).items),
    enabled: !!sessionId,
  });
}

export function useCreateSnapshot(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (label: string) => api.post<SnapshotRow>(`/context/sessions/${sessionId}/snapshots`, { label }),
    onSuccess: () => qc.invalidateQueries({ queryKey: contextKeys.snapshots(sessionId) }),
  });
}

export function useRestoreSnapshot(_sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (snapshotId: string) => api.post(`/context/snapshots/${snapshotId}/restore`),
    onSuccess: () => qc.invalidateQueries({ queryKey: contextKeys.all }),
  });
}
