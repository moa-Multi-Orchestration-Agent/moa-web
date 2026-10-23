import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Page } from '@/shared/lib/api-client';
import { wsKey } from '@/shared/lib/query';
import { apiKeyRowSchema, issuedKeySchema, toApiKey, type ApiKeyRow } from './model';

export const apiKeyKeys = { all: ['api-keys'] as const, list: () => ['api-keys', wsKey()] as const };

export function useApiKeys() {
  return useQuery({
    queryKey: apiKeyKeys.list(),
    queryFn: async () => apiKeyRowSchema.array().parse((await api.get<Page<unknown>>('/api-keys')).items),
    select: (rows) => rows.map(toApiKey),
  });
}

export function useIssueKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; expires_at: string | null }) => issuedKeySchema.parse(await api.post('/api-keys', input)),
    onSuccess: () => qc.invalidateQueries({ queryKey: apiKeyKeys.all }),
  });
}

export function useRevokeKey() {
  const qc = useQueryClient();
  const key = apiKeyKeys.list();
  return useMutation({
    mutationFn: (id: string) => api.delete<ApiKeyRow>(`/api-keys/${id}`),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<ApiKeyRow[]>(key);
      qc.setQueryData<ApiKeyRow[]>(key, (rows) => rows?.map((k) => (k.id === id ? { ...k, revoked_at: new Date().toISOString() } : k)));
      return { prev };
    },
    onError: (_e, _v, ctx) => qc.setQueryData(key, ctx?.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: apiKeyKeys.all }),
  });
}
