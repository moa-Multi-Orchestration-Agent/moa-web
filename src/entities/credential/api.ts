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

// ===== 확장: 지식베이스 문서 =====
export interface KbDocument {
  id: string;
  kb_id: string;
  filename: string;
  mime: string;
  bytes: number;
  status: 'pending' | 'indexing' | 'ready' | 'failed';
  chunk_count: number;
  error: string | null;
  created_at: string;
}

export function useKbDocuments(kbId: string | null) {
  return useQuery({
    queryKey: ['knowledge-bases', wsKey(), 'docs', kbId ?? '_'],
    queryFn: async () => (await api.get<Page<KbDocument>>(`/knowledge-bases/${kbId}/documents`)).items,
    enabled: !!kbId,
    // 색인 중인 문서가 있으면 1.5초마다 상태를 새로 고친다
    refetchInterval: (q) => (q.state.data?.some((d) => d.status === 'pending' || d.status === 'indexing') ? 1500 : false),
  });
}

export function useUploadKbDocument(kbId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: { filename: string; mime: string; bytes: number }) => api.post<KbDocument & { upload_url: string }>(`/knowledge-bases/${kbId}/documents`, file),
    onSettled: () => qc.invalidateQueries({ queryKey: ['knowledge-bases'] }),
  });
}

export function useDeleteKbDocument(kbId: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (docId: string) => api.delete(`/knowledge-bases/${kbId}/documents/${docId}`), onSettled: () => qc.invalidateQueries({ queryKey: ['knowledge-bases'] }) });
}
