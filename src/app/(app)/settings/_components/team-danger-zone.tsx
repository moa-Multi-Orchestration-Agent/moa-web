'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useCurrentWorkspace, useCurrentWorkspaceStore, useDeleteWorkspace, useLeaveWorkspace } from '@/entities/workspace';
import { copy } from '@/shared/lib/copy';
import { Button } from '@/shared/ui/button';
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { SectionCard } from '@/shared/ui/page-header';

/** 팀 나가기(소유자 제외)·팀 삭제(소유자, 이름 확인) */
export function TeamDangerZone() {
  const { workspace, role, query } = useCurrentWorkspace();
  const setId = useCurrentWorkspaceStore((s) => s.setId);
  const router = useRouter();
  const leave = useLeaveWorkspace();
  const del = useDeleteWorkspace();
  const [leaving, setLeaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmName, setConfirmName] = useState('');
  if (!workspace) return null;
  const others = (query.data ?? []).filter((w) => w.id !== workspace.id);
  const isOwner = role === 'owner';

  // 지금 팀에서 빠지면 남은 팀으로 바꾼다(헤더의 X-Workspace-Id가 남아 403이 나지 않게)
  const moveAway = () => {
    setId(others[0]?.id ?? null);
    router.push('/home');
  };

  return (
    <SectionCard title="팀 관리">
      <div className="divide-y">
        {!isOwner ? (
          <div className="flex items-center justify-between gap-4 py-3">
            <div>
              <p className="text-sm font-medium">{copy.team.leave}</p>
              <p className="text-muted text-xs">{copy.team.leaveDesc}</p>
            </div>
            <Button variant="outline" onClick={() => setLeaving(true)} data-testid="leave-team"><LogOut aria-hidden /> {copy.team.leave}</Button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-4 py-3">
            <div>
              <p className="text-sm font-medium">{copy.team.delete}</p>
              <p className="text-muted text-xs">{copy.team.deleteDesc}</p>
              {others.length === 0 ? <p className="text-warning mt-1 text-xs">마지막 남은 팀은 삭제할 수 없습니다. 다른 팀을 먼저 만드세요.</p> : null}
              <p className="text-muted mt-1 text-xs">팀에서 나가려면 먼저 팀원 목록의 역할 변경 메뉴에서 소유권을 넘기세요.</p>
            </div>
            <Button variant="destructive" disabled={others.length === 0} onClick={() => { setConfirmName(''); setDeleting(true); }} data-testid="delete-team"><Trash2 aria-hidden /> {copy.team.delete}</Button>
          </div>
        )}
      </div>
      <ConfirmDialog
        open={leaving}
        onOpenChange={setLeaving}
        title={copy.team.leaveConfirm(workspace.name)}
        description={copy.team.leaveDesc}
        confirmLabel={copy.team.leave}
        destructive
        pending={leave.isPending}
        onConfirm={() => leave.mutate(workspace.id, { onSuccess: () => { toast.success(copy.team.left); moveAway(); }, onError: (e) => toast.error(e.message), onSettled: () => setLeaving(false) })}
      />
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={`'${workspace.name}' 팀을 삭제할까요?`}
        description={
          <span className="block space-y-2">
            <span className="block">{copy.team.deleteDesc}</span>
            <Label htmlFor="del-team-name" className="block text-xs">{copy.team.deleteTypeName(workspace.name)}</Label>
            <Input id="del-team-name" value={confirmName} onChange={(e) => setConfirmName(e.target.value)} autoComplete="off" />
          </span>
        }
        confirmLabel={copy.team.delete}
        destructive
        confirmDisabled={confirmName.trim() !== workspace.name}
        pending={del.isPending}
        onConfirm={() => del.mutate({ id: workspace.id, confirmName }, { onSuccess: () => { toast.success(copy.team.deleted); moveAway(); }, onError: (e) => toast.error(e.message), onSettled: () => setDeleting(false) })}
      />
    </SectionCard>
  );
}
