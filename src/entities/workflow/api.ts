import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Page } from '@/shared/lib/api-client';
import { camelKeys } from '@/shared/lib/case';
import { flattenPages, patchEverywhere, restore, wsKey } from '@/shared/lib/query';
import {
  draftSaveResponseSchema,
  nodeCatalogSchema,
  toWorkflow,
  validationIssueSchema,
  workflowDetailSchema,
  workflowRowSchema,
  workflowVersionRowSchema,
  type WorkflowCreateInput,
  type WorkflowDefinition,
  type WorkflowDetailRow,
  type WorkflowRow,
  type WorkflowVersionRow,
} from './model';
import { z } from 'zod';

export interface WorkflowListParams {
  q?: string;
  filter?: 'all' | 'deployed' | 'draft' | 'listed' | 'linked';
  trigger?: string;
  sort?: 'updated' | 'name' | 'runs';
  limit?: number;
}

export const workflowKeys = {
  all: ['workflows'] as const,
  list: (p: WorkflowListParams = {}) => ['workflows', wsKey(), 'list', p] as const,
  detail: (id: string) => ['workflows', wsKey(), 'detail', id] as const,
  versions: (id: string) => ['workflows', wsKey(), 'versions', id] as const,
  version: (id: string, v: number) => ['workflows', wsKey(), 'version', id, v] as const,
  catalog: ['node-catalog'] as const,
};

export const toWorkflowDetail = (r: WorkflowDetailRow) => camelKeys(r);
export type WorkflowDetail = ReturnType<typeof toWorkflowDetail>;

export async function fetchWorkflows(p: WorkflowListParams & { cursor?: string | null }) {
  const r = await api.get<Page<unknown>>('/workflows', { query: { ...p, cursor: p.cursor ?? undefined, limit: p.limit ?? 20 } });
  return { items: workflowRowSchema.array().parse(r.items), next_cursor: r.next_cursor };
}

export function useWorkflows(p: WorkflowListParams = {}) {
  const q = useInfiniteQuery({
    queryKey: workflowKeys.list(p),
    queryFn: ({ pageParam }) => fetchWorkflows({ ...p, cursor: pageParam }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_cursor,
  });
  return { ...q, items: flattenPages(q.data).map(toWorkflow) };
}

export async function fetchWorkflow(id: string) {
  return workflowDetailSchema.parse(await api.get(`/workflows/${id}`));
}

export function useWorkflow(id: string | null | undefined) {
  return useQuery({ queryKey: workflowKeys.detail(id ?? '_'), queryFn: () => fetchWorkflow(id!), select: toWorkflowDetail, enabled: !!id });
}

export function useCreateWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: WorkflowCreateInput) => api.post<WorkflowDetailRow>('/workflows', input),
    onSuccess: () => qc.invalidateQueries({ queryKey: workflowKeys.all }),
  });
}

export function useUpdateWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string; name?: string; description?: string | null }) => api.patch<WorkflowDetailRow>(`/workflows/${id}`, patch),
    onMutate: async ({ id, ...patch }) => {
      await qc.cancelQueries({ queryKey: workflowKeys.all });
      const snap = patchEverywhere<WorkflowRow>(qc, workflowKeys.all, id, (w) => ({ ...w, ...patch }));
      return { snap };
    },
    onError: (_e, _v, ctx) => restore(qc, ctx?.snap),
    onSettled: () => qc.invalidateQueries({ queryKey: workflowKeys.all }),
  });
}

export function useDeleteWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/workflows/${id}`),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: workflowKeys.all });
      return { snap: patchEverywhere<WorkflowRow>(qc, workflowKeys.all, id, () => null) };
    },
    onError: (_e, _v, ctx) => restore(qc, ctx?.snap),
    onSettled: () => qc.invalidateQueries({ queryKey: workflowKeys.all }),
  });
}

export function useDuplicateWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<WorkflowDetailRow>(`/workflows/${id}/duplicate`),
    onSuccess: () => qc.invalidateQueries({ queryKey: workflowKeys.all }),
  });
}

/** 초안 저장 (design.md 2.6.4). 편집기 스토어의 자동 저장이 직접 부른다. */
export async function saveDraft(id: string, defn: WorkflowDefinition, draftVersion: number) {
  return draftSaveResponseSchema.parse(await api.put(`/workflows/${id}/draft`, defn, { ifMatch: draftVersion }));
}

const validateResponseSchema = z.object({ issues: z.array(validationIssueSchema), order: z.array(z.string()) });
export async function validateWorkflow(id: string, defn?: Pick<WorkflowDefinition, 'nodes' | 'edges'>) {
  return validateResponseSchema.parse(await api.post(`/workflows/${id}/validate`, defn ?? {}));
}

export function useWorkflowVersions(id: string | null | undefined) {
  return useQuery({
    queryKey: workflowKeys.versions(id ?? '_'),
    queryFn: async () => workflowVersionRowSchema.array().parse((await api.get<Page<unknown>>(`/workflows/${id}/versions`)).items),
    enabled: !!id,
  });
}

export function useWorkflowVersion(id: string | null | undefined, version: number | null) {
  return useQuery({
    queryKey: workflowKeys.version(id ?? '_', version ?? 0),
    queryFn: async () => workflowVersionRowSchema.parse(await api.get(`/workflows/${id}/versions/${version}`)),
    enabled: !!id && !!version,
    staleTime: Infinity,
  });
}

export function useCreateVersion(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (note: string) => api.post<WorkflowVersionRow>(`/workflows/${id}/versions`, { note }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: workflowKeys.versions(id) });
      void qc.invalidateQueries({ queryKey: workflowKeys.all, refetchType: 'none' });
    },
  });
}

export function useNodeCatalog() {
  return useQuery({ queryKey: workflowKeys.catalog, queryFn: async () => nodeCatalogSchema.parse(await api.get('/node-catalog')), staleTime: Infinity });
}
