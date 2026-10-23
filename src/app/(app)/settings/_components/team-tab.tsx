'use client';

import { useState } from 'react';
import { Check, ChevronDown, Loader2, Minus, Plus, UserMinus } from 'lucide-react';
import { toast } from 'sonner';
import { inviteFormSchema, useCurrentWorkspace, useInvite, useMembers, useRemoveMember, useUpdateMemberRole, type InviteForm, type Role } from '@/entities/workspace';
import { useMe } from '@/entities/user';
import { isApiError } from '@/shared/lib/api-client';
import { copy } from '@/shared/lib/copy';
import { relativeTime } from '@/shared/lib/format';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from '@/shared/ui/dropdown-menu';
import { Guarded } from '@/shared/ui/guarded';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { SectionCard } from '@/shared/ui/page-header';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { ErrorState, ListSkeleton } from '@/shared/ui/states';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';

const ROLE_BADGE: Record<Role, 'dark' | 'blue' | 'gray'> = { owner: 'dark', admin: 'blue', maker: 'gray', viewer: 'gray' };

/** design.md 3.1.1 RBAC 매트릭스 */
const MATRIX: [string, boolean[]][] = [
  ['에이전트·워크플로 조회, 실행 이력 조회', [true, true, true, true]],
  ['에이전트·워크플로 생성·수정, 테스트 실행', [true, true, true, false]],
  ['엔드포인트 배포', [true, true, true, false]],
  ['삭제, API 키 발급·폐기, 자격증명·MCP 관리', [true, true, false, false]],
  ['마켓 등록·구매, 예산 설정', [true, true, false, false]],
  ['실행 승인(승인자 지정이 없을 때)', [true, true, false, false]],
  ['멤버 초대·역할 변경', [true, true, false, false]],
  ['워크스페이스 삭제·소유권 이전', [true, false, false, false]],
];

export function TeamTab() {
  const { workspace, can, role } = useCurrentWorkspace();
  const me = useMe();
  const members = useMembers(workspace?.id);
  const invite = useInvite(workspace?.id ?? '');
  const change = useUpdateMemberRole(workspace?.id ?? '');
  const remove = useRemoveMember(workspace?.id ?? '');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<InviteForm>({ email: '', role: 'maker' });
  const [err, setErr] = useState<string | null>(null);
  const [removing, setRemoving] = useState<{ id: string; name: string } | null>(null);

  const submit = () => {
    const r = inviteFormSchema.safeParse(form);
    if (!r.success) return setErr(r.error.issues[0]!.message);
    invite.mutate(r.data, { onSuccess: () => { toast.success(`${r.data.email}을(를) 초대했습니다.`); setOpen(false); setForm({ email: '', role: 'maker' }); }, onError: (e) => setErr(isApiError(e) ? e.detail : e.message) });
  };

  return (
    <div className="space-y-5">
      <SectionCard
        title="팀원"
        actions={
          <Guarded allowed={can('invite')} reason={copy.common.adminOnly}>
            <Button size="sm" variant="outline" onClick={() => { setErr(null); setOpen(true); }}><Plus aria-hidden /> 초대</Button>
          </Guarded>
        }
        bodyClassName="p-0 pt-3"
      >
        {members.isPending ? <div className="p-5"><ListSkeleton rows={4} /></div> : members.isError ? <div className="p-5"><ErrorState error={members.error} onRetry={() => void members.refetch()} /></div> : (
          <Table>
            <TableHeader className="bg-surface"><TableRow><TableHead>이름</TableHead><TableHead>역할</TableHead><TableHead>마지막 접속</TableHead><TableHead className="w-56"><span className="sr-only">관리</span></TableHead></TableRow></TableHeader>
            <TableBody>
              {members.data!.map((m) => {
                const isOwner = m.role === 'owner';
                const self = m.userId === me.data?.id;
                const editable = can('invite') && !isOwner && !(role === 'admin' && m.role === 'admin' && !self);
                return (
                  <TableRow key={m.userId}>
                    <TableCell>
                      <p className="font-medium">{m.user.display_name}{self ? <span className="text-muted"> (나)</span> : null}</p>
                      <p className="text-muted text-xs">{m.user.email}</p>
                    </TableCell>
                    <TableCell className="space-x-1">
                      <Badge variant={ROLE_BADGE[m.role]}>{copy.roles[m.role]}</Badge>
                      {m.invited ? <Badge variant="orange">초대 대기</Badge> : null}
                    </TableCell>
                    <TableCell className="text-muted">{m.lastSeenAt ? relativeTime(m.lastSeenAt) : '—'}</TableCell>
                    <TableCell>
                      {isOwner ? <span className="text-muted text-xs">소유자는 1명입니다 · 이전은 소유자만</span> : (
                        <div className="flex gap-1">
                          <DropdownMenu>
                            <Guarded allowed={editable} reason={copy.common.adminOnly}>
                              <DropdownMenuTrigger asChild>
                                <Button size="sm" variant="ghost" aria-label={`${m.user.display_name} 역할 변경`}>역할 변경 <ChevronDown aria-hidden /></Button>
                              </DropdownMenuTrigger>
                            </Guarded>
                            <DropdownMenuContent>
                              <DropdownMenuRadioGroup value={m.role} onValueChange={(v) => change.mutate({ userId: m.userId, role: v as Role }, { onSuccess: () => toast.success('역할을 바꿨습니다.'), onError: (e) => toast.error(e.message) })}>
                                {(['admin', 'maker', 'viewer'] as const).map((r) => <DropdownMenuRadioItem key={r} value={r}>{copy.roles[r]}</DropdownMenuRadioItem>)}
                              </DropdownMenuRadioGroup>
                            </DropdownMenuContent>
                          </DropdownMenu>
                          <Guarded allowed={editable} reason={copy.common.adminOnly}>
                            <Button size="icon-sm" variant="ghost" onClick={() => setRemoving({ id: m.userId, name: m.user.display_name })} aria-label={`${m.user.display_name} 내보내기`}><UserMinus aria-hidden /></Button>
                          </Guarded>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </SectionCard>
      <SectionCard title="역할별 권한" bodyClassName="p-0 pt-3">
        <Table>
          <TableHeader className="bg-surface"><TableRow><TableHead>권한</TableHead>{(['owner', 'admin', 'maker', 'viewer'] as const).map((r) => <TableHead key={r} className="text-center">{copy.roles[r]}</TableHead>)}</TableRow></TableHeader>
          <TableBody>
            {MATRIX.map(([label, cells]) => (
              <TableRow key={label}>
                <TableCell>{label}</TableCell>
                {cells.map((ok, i) => <TableCell key={i} className="text-center">{ok ? <Check className="text-success mx-auto size-4" aria-label="가능" /> : <Minus className="text-muted mx-auto size-4" aria-label="불가" />}</TableCell>)}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </SectionCard>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="space-y-4">
            <DialogHeader><DialogTitle>팀원 초대</DialogTitle><DialogDescription>초대 메일을 보냅니다(목: 바로 멤버 목록에 &quot;초대 대기&quot;로 추가).</DialogDescription></DialogHeader>
            <div className="space-y-1.5"><Label htmlFor="inv-email">이메일</Label><Input id="inv-email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} autoFocus /></div>
            <div className="space-y-1.5">
              <Label htmlFor="inv-role">역할</Label>
              <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v as InviteForm['role'] }))}>
                <SelectTrigger id="inv-role" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{(['admin', 'maker', 'viewer'] as const).map((r) => <SelectItem key={r} value={r}>{copy.roles[r]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {err ? <p role="alert" className="text-danger text-sm">{err}</p> : null}
            <DialogFooter><Button type="button" variant="ghost" onClick={() => setOpen(false)}>취소</Button><Button type="submit" disabled={invite.isPending}>{invite.isPending ? <Loader2 className="animate-spin" aria-hidden /> : null}초대</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmDialog open={!!removing} onOpenChange={(o) => !o && setRemoving(null)} title={`${removing?.name}님을 내보낼까요?`} description="이 워크스페이스에 더 이상 접근할 수 없습니다." confirmLabel="내보내기" pending={remove.isPending} onConfirm={() => remove.mutate(removing!.id, { onSuccess: () => toast.success('내보냈습니다.'), onError: (e) => toast.error(e.message), onSettled: () => setRemoving(null) })} />
    </div>
  );
}
