'use client';

import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { PROVIDERS, providerInfo, useCredentials, useDeleteCredential, type Credential } from '@/entities/credential';
import { useCurrentWorkspace } from '@/entities/workspace';
import { copy } from '@/shared/lib/copy';
import { formatDate } from '@/shared/lib/format';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';
import { Guarded } from '@/shared/ui/guarded';
import { SectionCard } from '@/shared/ui/page-header';
import { EmptyState, ErrorState, ListSkeleton } from '@/shared/ui/states';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { AddCredentialDialog, EditCredentialDialog } from './credential-dialogs';

/** 자격증명: 제공자별 등록, 값은 저장 후 마스킹, 사용처 표시. modelKeysOnly면 모델 키만 */
export function CredentialsCard({ modelKeysOnly }: { modelKeysOnly?: boolean }) {
  const q = useCredentials();
  const del = useDeleteCredential();
  const { can } = useCurrentWorkspace();
  const providers = PROVIDERS.filter((p) => !modelKeysOnly || p.purposes.includes('llm' as never));
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Credential | null>(null);
  const [deleting, setDeleting] = useState<{ id: string; label: string } | null>(null);
  const rows = (q.data ?? []).filter((c) => !modelKeysOnly || c.purposes.includes('llm'));
  const soon = (iso: string | null) => !!iso && new Date(iso).getTime() - Date.now() < 14 * 86_400_000;

  return (
    <SectionCard
      title={modelKeysOnly ? '모델 키' : '자격증명'}
      actions={<Guarded allowed={can('manageKeys')} reason={copy.common.adminOnly}><Button size="sm" variant="outline" onClick={() => setOpen(true)}><Plus aria-hidden /> 추가</Button></Guarded>}
      bodyClassName="p-0 pt-3"
    >
      {q.isPending ? <div className="p-5"><ListSkeleton rows={3} /></div> : q.isError ? <div className="p-5"><ErrorState error={q.error} onRetry={() => void q.refetch()} /></div> : !rows.length ? <div className="p-5"><EmptyState title="등록한 자격증명이 없어요" description="메일 계정, 모델 키, MCP 토큰 등을 저장하면 노드·스킬이 실행할 때 씁니다." /></div> : (
        <Table>
          <TableHeader className="bg-surface"><TableRow><TableHead>자격증명명</TableHead><TableHead>종류</TableHead><TableHead>값</TableHead><TableHead>사용 중</TableHead><TableHead>상태</TableHead><TableHead className="w-20"><span className="sr-only">수정·삭제</span></TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.label}</TableCell>
                <TableCell>{providerInfo(c.provider)?.kind ?? c.provider}</TableCell>
                <TableCell className="font-mono text-xs">{c.masked}{c.baseUrl ? <span className="text-muted block max-w-56 truncate" title={c.baseUrl}>{c.baseUrl}</span> : null}</TableCell>
                <TableCell className="text-muted">{c.usedBy.join(' · ') || '없음'}</TableCell>
                <TableCell>{c.isDemo ? <Badge variant="orange">보기용 시드 키</Badge> : soon(c.expiresAt) ? <Badge variant="orange">만료 {formatDate(c.expiresAt)}</Badge> : <Badge variant="gray">암호화 저장</Badge>}</TableCell>
                <TableCell><Guarded allowed={can('manageKeys')} reason={copy.common.adminOnly}><div className="flex"><Button size="icon-sm" variant="ghost" onClick={() => setEditing(c)} aria-label={`${c.label} 수정`}><Pencil aria-hidden /></Button><Button size="icon-sm" variant="ghost" onClick={() => setDeleting({ id: c.id, label: c.label })} aria-label={`${c.label} 삭제`}><Trash2 aria-hidden /></Button></div></Guarded></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <AddCredentialDialog open={open} onOpenChange={setOpen} providers={providers} modelKeysOnly={modelKeysOnly} />
      <EditCredentialDialog credential={editing} onOpenChange={(o) => !o && setEditing(null)} />
      <ConfirmDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)} title={`"${deleting?.label}"을(를) 삭제할까요?`} description="이 자격증명을 쓰는 노드·스킬은 실행할 때 MOA-NODE-004로 실패합니다." pending={del.isPending} onConfirm={() => del.mutate(deleting!.id, { onSuccess: () => toast.success('삭제했습니다.'), onError: (e) => toast.error(e.message), onSettled: () => setDeleting(null) })} />
    </SectionCard>
  );
}
