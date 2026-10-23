'use client';

import { Camera, History } from 'lucide-react';
import { toast } from 'sonner';
import { useCreateSnapshot, useRestoreSnapshot, useSnapshots } from '@/entities/context';
import { formatTime } from '@/shared/lib/format';
import { Button } from '@/shared/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover';
import { ErrorState, ListSkeleton } from '@/shared/ui/states';

export function SnapshotControls({ sessionId, readOnly }: { sessionId: string; readOnly?: boolean }) {
  const snaps = useSnapshots(sessionId);
  const create = useCreateSnapshot(sessionId);
  const restore = useRestoreSnapshot(sessionId);
  return (
    <>
      <Button
        size="sm"
        variant="outline"
        disabled={readOnly || create.isPending}
        onClick={() =>
          create.mutate(`스냅샷 ${formatTime(new Date().toISOString())}`, {
            onSuccess: (s) => toast.success(`"${s.label}"을(를) 저장했습니다.`),
            onError: (e) => toast.error(e.message),
          })
        }
      >
        <Camera aria-hidden /> 스냅샷 저장
      </Button>
      <Popover>
        <PopoverTrigger asChild>
          <Button size="sm" variant="outline" aria-label="스냅샷 복원">
            <History aria-hidden /> 복원
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 p-2">
          <p className="text-muted px-2 pb-1 text-xs">복원하면 지금 블록은 꺼지고 스냅샷 블록이 다시 들어갑니다.</p>
          {snaps.isPending ? (
            <ListSkeleton rows={2} />
          ) : snaps.isError ? (
            <ErrorState compact error={snaps.error} onRetry={() => void snaps.refetch()} />
          ) : !snaps.data?.length ? (
            <p className="text-muted p-3 text-center text-sm">저장한 스냅샷이 없어요.</p>
          ) : (
            <ul>
              {snaps.data.map((s) => (
                <li key={s.id} className="hover:bg-surface flex items-center gap-2 rounded px-2 py-1.5 text-sm">
                  <span className="flex-1 truncate">{s.label}</span>
                  <span className="text-muted text-xs">블록 {s.block_count}</span>
                  <Button size="xs" variant="outline" disabled={readOnly || restore.isPending} onClick={() => restore.mutate(s.id, { onSuccess: () => toast.success('스냅샷으로 복원했습니다.'), onError: (e) => toast.error(e.message) })}>
                    복원
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </PopoverContent>
      </Popover>
    </>
  );
}

