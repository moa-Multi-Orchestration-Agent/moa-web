'use client';

import { Loader2, PlugZap } from 'lucide-react';
import { toast } from 'sonner';
import { FAMILY_LABEL, MODEL_SOURCE_LABEL, useModels, useSetModelDefaults, useTestCredential } from '@/entities/credential';
import { useCurrentWorkspace } from '@/entities/workspace';
import { copy } from '@/shared/lib/copy';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Guarded } from '@/shared/ui/guarded';
import { SectionCard } from '@/shared/ui/page-header';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { ErrorState, ListSkeleton } from '@/shared/ui/states';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { CredentialsCard } from './credentials';

const KEYED = ['anthropic', 'openai', 'google'] as const;
const SOURCE_BADGE = { workspace: 'blue', server: 'gray', demo: 'orange' } as const;

/**
 * 모델 키: 제공자별로 키를 등록하고 기본 키를 고르면, LLM 노드·에이전트가 그 키를 가져다 쓴다.
 * 노드에서 키를 따로 고르면 그 키가 먼저다.
 */
export function ModelKeysTab() {
  const q = useModels();
  const setDefaults = useSetModelDefaults();
  const test = useTestCredential();
  const { can } = useCurrentWorkspace();

  const runTest = (id: string) =>
    test.mutate(id, {
      onSuccess: (r) => (r.ok ? toast.success(r.message) : r.checked ? toast.error(r.message) : toast.info(r.message)),
      onError: (e) => toast.error(e.message),
    });

  return (
    <div className="space-y-6">
      <SectionCard title="제공자별 기본 키" bodyClassName="p-0 pt-3">
        <p className="text-muted px-5 pb-3 text-sm">
          여기서 고른 키를 LLM 노드와 에이전트가 기본으로 씁니다. 노드·에이전트 설정에서 다른 키를 고를 수도 있어요. 키가 없으면 실제 모델 대신 데모 응답이 나옵니다.
        </p>
        {q.isPending ? <div className="p-5"><ListSkeleton rows={3} /></div> : q.isError ? <div className="p-5"><ErrorState error={q.error} onRetry={() => void q.refetch()} /></div> : (
          <Table>
            <TableHeader className="bg-surface"><TableRow><TableHead>제공자</TableHead><TableHead>모델</TableHead><TableHead>지금 상태</TableHead><TableHead className="w-72">기본 키</TableHead><TableHead className="w-28"><span className="sr-only">연결 확인</span></TableHead></TableRow></TableHeader>
            <TableBody>
              {KEYED.map((family) => {
                const rows = q.data!.items.filter((m) => m.family === family);
                const first = rows[0];
                if (!first) return null;
                const keys = first.credentials;
                const current = first.default_credential_id;
                return (
                  <TableRow key={family}>
                    <TableCell className="font-medium">{FAMILY_LABEL[family]}</TableCell>
                    <TableCell className="text-muted text-xs">{rows.map((m) => m.label).join(' · ')}</TableCell>
                    <TableCell><Badge variant={SOURCE_BADGE[first.source]}>{MODEL_SOURCE_LABEL[first.source]}</Badge></TableCell>
                    <TableCell>
                      {keys.length ? (
                        <Guarded allowed={can('manageKeys')} reason={copy.common.adminOnly}>
                          <Select value={current ?? undefined} onValueChange={(v) => setDefaults.mutate({ [family]: v }, { onSuccess: () => toast.success(`${FAMILY_LABEL[family]} 기본 키를 바꿨습니다.`), onError: (e) => toast.error(e.message) })} disabled={!can('manageKeys') || setDefaults.isPending}>
                            <SelectTrigger className="h-9 w-full" aria-label={`${FAMILY_LABEL[family]} 기본 키`}><SelectValue placeholder="키 고르기" /></SelectTrigger>
                            <SelectContent>{keys.map((k) => <SelectItem key={k.id} value={k.id}>{k.label} · {k.masked}{k.is_demo ? ' · 보기용' : ''}</SelectItem>)}</SelectContent>
                          </Select>
                        </Guarded>
                      ) : <span className="text-muted text-sm">등록한 키 없음 · 아래에서 추가</span>}
                    </TableCell>
                    <TableCell>
                      {current ? (
                        <Guarded allowed={can('manageKeys')} reason={copy.common.adminOnly}>
                          <Button size="sm" variant="ghost" onClick={() => runTest(current)} disabled={test.isPending} aria-label={`${FAMILY_LABEL[family]} 키 연결 확인`}>
                            {test.isPending && test.variables === current ? <Loader2 className="animate-spin" aria-hidden /> : <PlugZap aria-hidden />} 연결 확인
                          </Button>
                        </Guarded>
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </SectionCard>
      <CredentialsCard modelKeysOnly />
    </div>
  );
}
