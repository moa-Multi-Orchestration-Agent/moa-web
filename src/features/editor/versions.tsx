'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useCreateVersion, useWorkflowVersion, useWorkflowVersions } from '@/entities/workflow';
import { isApiError } from '@/shared/lib/api-client';
import { formatDateTime } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/shared/ui/sheet';
import { Skeleton } from '@/shared/ui/skeleton';
import { EmptyState, ErrorState, ListSkeleton } from '@/shared/ui/states';
import { FlowPreview } from './flow-preview';

export function SaveVersionDialog({ workflowId, open, onOpenChange, beforeSave }: { workflowId: string; open: boolean; onOpenChange: (o: boolean) => void; beforeSave: () => Promise<void> }) {
  const [note, setNote] = useState('');
  const create = useCreateVersion(workflowId);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      await beforeSave();
      const v = await create.mutateAsync(note);
      toast.success(`버전 v${v.version}을(를) 저장했습니다.`);
      setNote('');
      onOpenChange(false);
    } catch (e) {
      toast.error(isApiError(e) ? `${e.detail} 인스펙터의 오류 목록을 확인하세요.` : (e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>버전 저장</DialogTitle>
          <DialogDescription>지금 초안을 바꿀 수 없는 버전으로 남깁니다. 배포는 버전 단위로 이뤄집니다. 검증 오류가 있으면 저장할 수 없어요.</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="version-note">메모</Label>
          <Input id="version-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="예: 3D 파라미터 조정" maxLength={120} autoFocus />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button onClick={() => void submit()} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" aria-hidden /> : null}버전 저장
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function VersionsSheet({ workflowId, open, onOpenChange, initial }: { workflowId: string; open: boolean; onOpenChange: (o: boolean) => void; initial?: number | null }) {
  const list = useWorkflowVersions(open ? workflowId : null);
  const [picked, setPicked] = useState<number | null>(initial ?? null);
  const current = picked ?? list.data?.[0]?.version ?? null;
  const version = useWorkflowVersion(open ? workflowId : null, current);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-[720px]">
        <SheetHeader>
          <SheetTitle>버전 기록</SheetTitle>
          <SheetDescription>저장한 버전은 바꿀 수 없습니다(읽기 전용). 배포·실행은 고정된 버전을 씁니다.</SheetDescription>
        </SheetHeader>
        <div className="grid min-h-0 flex-1 grid-cols-[200px_1fr] gap-4 overflow-hidden px-4 pb-4">
          <div className="overflow-y-auto">
            {list.isPending ? (
              <ListSkeleton rows={4} />
            ) : list.isError ? (
              <ErrorState compact error={list.error} onRetry={() => void list.refetch()} />
            ) : !list.data?.length ? (
              <EmptyState title="버전이 없어요" description="상단의 '버전 저장'으로 첫 버전을 남기세요." />
            ) : (
              <ul className="space-y-1" role="listbox" aria-label="버전 목록">
                {list.data.map((v) => (
                  <li key={v.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={current === v.version}
                      onClick={() => setPicked(v.version)}
                      className={cn('w-full rounded-md border px-3 py-2 text-left text-sm', current === v.version ? 'border-primary bg-primary-soft' : 'hover:bg-surface')}
                    >
                      <span className="font-mono font-semibold">v{v.version}</span>
                      <span className="text-muted block truncate text-xs">{v.note ?? '메모 없음'}</span>
                      <span className="text-muted block text-[11px]">{formatDateTime(v.created_at)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="min-w-0">
            {version.isPending && current ? (
              <Skeleton className="h-[420px] w-full" />
            ) : version.data?.definition ? (
              <>
                <div className="mb-2 flex items-center gap-2">
                  <Badge variant="gray">읽기 전용</Badge>
                  <span className="text-muted text-xs">노드 {version.data.definition.nodes.length}개 · 해시 {version.data.def_hash.slice(0, 10)}</span>
                </div>
                <FlowPreview definition={version.data.definition} height={420} />
              </>
            ) : null}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
