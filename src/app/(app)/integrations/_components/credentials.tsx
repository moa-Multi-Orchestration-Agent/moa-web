'use client';

import { useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { credentialFormSchema, PROVIDERS, providerInfo, useCreateCredential, useCredentials, useDeleteCredential, type CredentialForm } from '@/entities/credential';
import { useCurrentWorkspace } from '@/entities/workspace';
import { copy } from '@/shared/lib/copy';
import { formatDate } from '@/shared/lib/format';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { Guarded } from '@/shared/ui/guarded';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { SectionCard } from '@/shared/ui/page-header';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { EmptyState, ErrorState, ListSkeleton } from '@/shared/ui/states';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';

/** 자격증명: 제공자별 등록, 값은 저장 후 마스킹, 사용처 표시. modelKeysOnly면 모델 키만 */
export function CredentialsCard({ modelKeysOnly }: { modelKeysOnly?: boolean }) {
  const q = useCredentials();
  const create = useCreateCredential();
  const del = useDeleteCredential();
  const { can } = useCurrentWorkspace();
  const providers = PROVIDERS.filter((p) => !modelKeysOnly || p.purposes.includes('llm' as never));
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CredentialForm>({ provider: providers[0]!.id, label: '', secret: '' });
  const [errs, setErrs] = useState<Partial<Record<keyof CredentialForm, string>>>({});
  const [deleting, setDeleting] = useState<{ id: string; label: string } | null>(null);
  const rows = (q.data ?? []).filter((c) => !modelKeysOnly || c.purposes.includes('llm'));
  const soon = (iso: string | null) => !!iso && new Date(iso).getTime() - Date.now() < 14 * 86_400_000;

  const submit = () => {
    const r = credentialFormSchema.safeParse(form);
    if (!r.success) return setErrs(Object.fromEntries(r.error.issues.map((i) => [i.path[0], i.message])));
    setErrs({});
    create.mutate({ ...r.data, purposes: [...(providerInfo(r.data.provider)?.purposes ?? [])] }, {
      onSuccess: (c) => { toast.success(`"${c.label}"을(를) 암호화해 저장했습니다.`); setOpen(false); setForm({ provider: providers[0]!.id, label: '', secret: '' }); },
      onError: (e) => toast.error(e.message),
    });
  };

  return (
    <SectionCard
      title={modelKeysOnly ? '모델 키' : '자격증명'}
      actions={<Guarded allowed={can('manageKeys')} reason={copy.common.adminOnly}><Button size="sm" variant="outline" onClick={() => setOpen(true)}><Plus aria-hidden /> 추가</Button></Guarded>}
      bodyClassName="p-0 pt-3"
    >
      {q.isPending ? <div className="p-5"><ListSkeleton rows={3} /></div> : q.isError ? <div className="p-5"><ErrorState error={q.error} onRetry={() => void q.refetch()} /></div> : !rows.length ? <div className="p-5"><EmptyState title="등록한 자격증명이 없어요" description="메일 계정, 모델 키, MCP 토큰 등을 저장하면 노드·스킬이 실행할 때 씁니다." /></div> : (
        <Table>
          <TableHeader className="bg-surface"><TableRow><TableHead>자격증명명</TableHead><TableHead>종류</TableHead><TableHead>값</TableHead><TableHead>사용 중</TableHead><TableHead>상태</TableHead><TableHead className="w-12"><span className="sr-only">삭제</span></TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.label}</TableCell>
                <TableCell>{providerInfo(c.provider)?.kind ?? c.provider}</TableCell>
                <TableCell className="font-mono text-xs">{c.masked}</TableCell>
                <TableCell className="text-muted">{c.usedBy.join(' · ') || '없음'}</TableCell>
                <TableCell>{soon(c.expiresAt) ? <Badge variant="orange">만료 {formatDate(c.expiresAt)}</Badge> : <Badge variant="gray">암호화 저장</Badge>}</TableCell>
                <TableCell><Guarded allowed={can('manageKeys')} reason={copy.common.adminOnly}><Button size="icon-sm" variant="ghost" onClick={() => setDeleting({ id: c.id, label: c.label })} aria-label={`${c.label} 삭제`}><Trash2 aria-hidden /></Button></Guarded></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="space-y-4" autoComplete="off">
            <DialogHeader><DialogTitle>{modelKeysOnly ? '모델 키 추가' : '자격증명 추가'}</DialogTitle><DialogDescription>값은 AES-256-GCM 봉투 암호화로 저장되고, 저장 후에는 다시 볼 수 없습니다(design.md 2.4.2).</DialogDescription></DialogHeader>
            <div className="space-y-1.5"><Label htmlFor="cred-provider">제공자</Label>
              <Select value={form.provider} onValueChange={(v) => setForm((f) => ({ ...f, provider: v }))}><SelectTrigger id="cred-provider" className="w-full"><SelectValue /></SelectTrigger><SelectContent>{providers.map((p) => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="space-y-1.5"><Label htmlFor="cred-label">이름</Label><Input id="cred-label" value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} placeholder="예: 팀 메일 계정" aria-invalid={!!errs.label} />{errs.label ? <p className="text-danger text-xs">{errs.label}</p> : null}</div>
            <div className="space-y-1.5"><Label htmlFor="cred-secret">값</Label><Input id="cred-secret" type="password" value={form.secret} onChange={(e) => setForm((f) => ({ ...f, secret: e.target.value }))} className="font-mono" aria-invalid={!!errs.secret} />{errs.secret ? <p className="text-danger text-xs">{errs.secret}</p> : null}</div>
            <DialogFooter><Button type="button" variant="ghost" onClick={() => setOpen(false)}>취소</Button><Button type="submit" disabled={create.isPending}>{create.isPending ? <Loader2 className="animate-spin" aria-hidden /> : null}저장</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)} title={`"${deleting?.label}"을(를) 삭제할까요?`} description="이 자격증명을 쓰는 노드·스킬은 실행할 때 MOA-NODE-004로 실패합니다." pending={del.isPending} onConfirm={() => del.mutate(deleting!.id, { onSuccess: () => toast.success('삭제했습니다.'), onError: (e) => toast.error(e.message), onSettled: () => setDeleting(null) })} />
    </SectionCard>
  );
}
