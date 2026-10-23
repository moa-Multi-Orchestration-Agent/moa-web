import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Page } from '@/shared/lib/api-client';
import { wsKey } from '@/shared/lib/query';
import { credentialRowSchema, toCredential, type CredentialForm, type CredentialRow, type KnowledgeBaseRow } from './model';

export const credentialKeys = { all: ['credentials'] as const, list: () => ['credentials', wsKey()] as const, kb: () => ['knowledge-bases', wsKey()] as const };

export function useCredentials() {
  return useQuery({
    queryKey: credentialKeys.list(),
    queryFn: async () => credentialRowSchema.array().parse((await api.get<Page<unknown>>('/credentials')).items),
    select: (rows) => rows.map(toCredential),
  });
}

export function useCreateCredential() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CredentialForm & { purposes: string[] }) => api.post<CredentialRow>('/credentials', input),
    onSuccess: () => qc.invalidateQueries({ queryKey: credentialKeys.all }),
  });
}

export function useDeleteCredential() {
  const qc = useQueryClient();
  const key = credentialKeys.list();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/credentials/${id}`),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<CredentialRow[]>(key);
      qc.setQueryData<CredentialRow[]>(key, (rows) => rows?.filter((c) => c.id !== id));
      return { prev };
    },
    onError: (_e, _v, ctx) => qc.setQueryData(key, ctx?.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: credentialKeys.all }),
  });
}

export function useKnowledgeBases() {
  return useQuery({ queryKey: credentialKeys.kb(), queryFn: async () => (await api.get<Page<KnowledgeBaseRow>>('/knowledge-bases')).items });
}
