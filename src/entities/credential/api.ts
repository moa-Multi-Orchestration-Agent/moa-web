import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Page } from '@/shared/lib/api-client';
import { wsKey } from '@/shared/lib/query';
import { credentialRowSchema, modelsResponseSchema, toCredential, type CredentialForm, type CredentialRow, type KbForm, type KbSearchHit, type KnowledgeBaseRow } from './model';

export const credentialKeys = { all: ['credentials'] as const, list: () => ['credentials', wsKey()] as const, kb: () => ['knowledge-bases', wsKey()] as const, models: () => ['models', wsKey()] as const };

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
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: credentialKeys.all });
      void qc.invalidateQueries({ queryKey: ['models'] });
    },
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
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: credentialKeys.all });
      void qc.invalidateQueries({ queryKey: ['models'] });
    },
  });
}

/** 모델 목록과 키 상태. 노드·에이전트에서 모델과 키를 고를 때 쓴다. */
export function useModels() {
  return useQuery({
    queryKey: credentialKeys.models(),
    queryFn: async () => modelsResponseSchema.parse(await api.get('/models')),
    staleTime: 30_000,
  });
}

export function useSetModelDefaults() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (defaults: Record<string, string | null>) => api.put('/models/defaults', defaults),
    onSettled: () => qc.invalidateQueries({ queryKey: ['models'] }),
  });
}

export function useTestCredential() {
  return useMutation({
    mutationFn: (id: string) => api.post<{ ok: boolean; checked: boolean; message: string }>(`/credentials/${id}/test`),
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

/** 문서 등록 → 파일 본문 업로드. 본문이 올라가야 실제 내용으로 색인된다. */
export function useUploadKbDocument(kbId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const doc = await api.post<KbDocument & { upload_url: string }>(`/knowledge-bases/${kbId}/documents`, { filename: file.name, mime: file.type || 'application/octet-stream', bytes: file.size });
      await api.put(`/knowledge-bases/${kbId}/documents/${doc.id}/upload`, file);
      return doc;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['knowledge-bases'] }),
  });
}

export function useDeleteKbDocument(kbId: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (docId: string) => api.delete(`/knowledge-bases/${kbId}/documents/${docId}`), onSettled: () => qc.invalidateQueries({ queryKey: ['knowledge-bases'] }) });
}

// ===== 지식베이스 만들기·수정·삭제·검색 테스트 =====
export function useCreateKb() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: KbForm) => api.post<KnowledgeBaseRow>('/knowledge-bases', input),
    onSettled: () => qc.invalidateQueries({ queryKey: ['knowledge-bases'] }),
  });
}

export function useUpdateKb(kbId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<KbForm>) => api.patch<KnowledgeBaseRow>(`/knowledge-bases/${kbId}`, input),
    onSettled: () => qc.invalidateQueries({ queryKey: ['knowledge-bases'] }),
  });
}

export function useDeleteKb() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (kbId: string) => api.delete(`/knowledge-bases/${kbId}`),
    onSettled: () => qc.invalidateQueries({ queryKey: ['knowledge-bases'] }),
  });
}

export function useSearchKb(kbId: string) {
  return useMutation({
    mutationFn: (input: { query: string; top_k: number }) => api.post<{ items: KbSearchHit[] }>(`/knowledge-bases/${kbId}/search`, input),
  });
}
