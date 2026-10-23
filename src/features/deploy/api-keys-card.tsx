'use client';

import { useState } from 'react';
import { KeyRound, Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { maskKey, useApiKeys, useIssueKey, useRevokeKey, type IssuedKey } from '@/entities/api-key';
import { useCurrentWorkspace } from '@/entities/workspace';
import { copy } from '@/shared/lib/copy';
import { formatDate, relativeTime } from '@/shared/lib/format';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';
import { CopyButton } from '@/shared/ui/copy-button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { Guarded } from '@/shared/ui/guarded';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { EmptyState, ErrorState, ListSkeleton } from '@/shared/ui/states';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';

const EXPIRES: Record<string, string> = { '30': '30일', '90': '90일', '365': '1년', never: '만료 없음' };

/** API 키: 발급(평문은 발급 직후 한 번만), 목록, 폐기. 배포 화면과 설정 > API 키가 같이 쓴다. */
export function ApiKeysCard({ onIssued, compact }: { onIssued?: (key: IssuedKey) => void; compact?: boolean }) {
  const q = useApiKeys();
  const issue = useIssueKey();
  const revoke = useRevokeKey();
  const { can } = useCurrentWorkspace();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [exp, setExp] = useState('90');
  const [issued, setIssued] = useState<IssuedKey | null>(null);
  const [revoking, setRevoking] = useState<{ id: string; name: string } | null>(null);

  const submit = () => {
    if (!name.trim()) return;
    const expires_at = exp === 'never' ? null : new Date(Date.now() + Number(exp) * 86_400_000).toISOString();
    issue.mutate(
      { name: name.trim(), expires_at },
      {
        onSuccess: (k) => {
          setIssued(k);
          setName('');
          onIssued?.(k);
        },
        onError: (e) => toast.error(e.message),
      },
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 font-bold">
          <KeyRound className="size-4" aria-hidden /> API 키
        </h3>
        <Guarded allowed={can('manageKeys')} reason={copy.common.adminOnly}>
          <Button size="sm" variant="outline" onClick={() => setOpen(true)} data-testid="issue-key">
            <Plus aria-hidden /> 새 키 발급
          </Button>
        </Guarded>
      </div>
      {q.isPending ? (
        <ListSkeleton rows={2} />
      ) : q.isError ? (
        <ErrorState compact error={q.error} onRetry={() => void q.refetch()} />
      ) : !q.data?.length ? (
        <EmptyState title="발급한 키가 없어요" description="배포 API를 부르려면 키가 필요합니다." className="py-6" />
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader className="bg-surface">
              <TableRow>
                <TableHead>이름</TableHead>
                <TableHead>키</TableHead>
                {!compact ? <TableHead>마지막 사용</TableHead> : null}
                <TableHead>{compact ? '생성일' : '만료'}</TableHead>
                <TableHead className="w-20">
                  <span className="sr-only">폐기</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {q.data.map((k) => (
                <TableRow key={k.id} className={k.revokedAt ? 'opacity-50' : undefined}>
                  <TableCell>{k.name}</TableCell>
                  <TableCell className="font-mono text-xs">{maskKey(k.prefix)}</TableCell>
                  {!compact ? <TableCell className="text-muted">{k.lastUsedAt ? relativeTime(k.lastUsedAt) : '사용 안 함'}</TableCell> : null}
                  <TableCell className="text-muted">{compact ? formatDate(k.createdAt) : k.expiresAt ? formatDate(k.expiresAt) : '없음'}</TableCell>
                  <TableCell>
                    {k.revokedAt ? (
                      <Badge variant="gray">폐기됨</Badge>
                    ) : (
                      <Guarded allowed={can('manageKeys')} reason={copy.common.adminOnly}>
                        <Button size="sm" variant="ghost" className="text-warning" onClick={() => setRevoking({ id: k.id, name: k.name })}>
                          폐기
                        </Button>
                      </Guarded>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setIssued(null);
        }}
      >
        <DialogContent>
          {issued ? (
            <>
              <DialogHeader>
                <DialogTitle>키를 발급했습니다</DialogTitle>
                <DialogDescription>이 키는 지금 한 번만 보여 줍니다. 창을 닫으면 다시 볼 수 없으니 안전한 곳에 복사해 두세요.</DialogDescription>
              </DialogHeader>
              <div className="bg-surface flex items-center gap-2 rounded-md border p-3">
                <code className="min-w-0 flex-1 font-mono text-xs break-all" data-testid="issued-key">
                  {issued.key}
                </code>
                <CopyButton value={issued.key} label="키 복사" />
              </div>
              <DialogFooter>
                <Button onClick={() => { setOpen(false); setIssued(null); }}>복사했어요, 닫기</Button>
              </DialogFooter>
            </>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="space-y-4">
              <DialogHeader>
                <DialogTitle>새 API 키</DialogTitle>
                <DialogDescription>키는 해시로만 저장되고, 평문은 발급 직후 한 번만 볼 수 있습니다(design.md 2.3.3).</DialogDescription>
              </DialogHeader>
              <div className="space-y-1.5">
                <Label htmlFor="key-name">이름</Label>
                <Input id="key-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 운영 서버" maxLength={40} autoFocus />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="key-exp">만료</Label>
                <Select value={exp} onValueChange={setExp}>
                  <SelectTrigger id="key-exp" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(EXPIRES).map(([v, l]) => (
                      <SelectItem key={v} value={v}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                  취소
                </Button>
                <Button type="submit" disabled={!name.trim() || issue.isPending}>
                  {issue.isPending ? <Loader2 className="animate-spin" aria-hidden /> : null}발급
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={!!revoking}
        onOpenChange={(o) => !o && setRevoking(null)}
        title={`"${revoking?.name}" 키를 폐기할까요?`}
        description="폐기하면 이 키로 하는 호출이 바로 401로 거부됩니다. 되돌릴 수 없어요."
        confirmLabel="폐기"
        pending={revoke.isPending}
        onConfirm={() => revoke.mutate(revoking!.id, { onSuccess: () => toast.success('키를 폐기했습니다.'), onError: (e) => toast.error(e.message), onSettled: () => setRevoking(null) })}
      />
    </div>
  );
}
