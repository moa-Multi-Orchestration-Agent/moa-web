import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Page } from '@/shared/lib/api-client';
import { camelKeys } from '@/shared/lib/case';
import { wsKey } from '@/shared/lib/query';
import { cloneResultSchema, templateDetailSchema, templateRowSchema, toTemplate, type TemplateDetailRow } from './model';

export interface TemplateParams {
  q?: string;
  category?: string;
  kind?: 'agent' | 'workflow';
}

export const templateKeys = {
  all: ['templates'] as const,
  list: (p: TemplateParams) => ['templates', 'list', p] as const,
  detail: (id: string) => ['templates', wsKey(), 'detail', id] as const,
};

export function useTemplates(p: TemplateParams = {}) {
  return useQuery({
    queryKey: templateKeys.list(p),
    queryFn: async () => templateRowSchema.array().parse((await api.get<Page<unknown>>('/templates', { query: { ...p } })).items),
    select: (rows) => rows.map(toTemplate),
    staleTime: 5 * 60_000,
  });
}

export const toTemplateDetail = (r: TemplateDetailRow) => camelKeys(r);

export function useTemplate(id: string | null | undefined) {
  return useQuery({
    queryKey: templateKeys.detail(id ?? '_'),
    queryFn: async () => templateDetailSchema.parse(await api.get(`/templates/${id}`)),
    select: toTemplateDetail,
    enabled: !!id,
  });
}

export function useInstantiateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: { id: string; name?: string; description?: string }) => cloneResultSchema.parse(await api.post(`/templates/${id}/instantiate`, input)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['agents'] });
      void qc.invalidateQueries({ queryKey: ['workflows'] });
    },
  });
}
