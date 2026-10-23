'use client';

import Link from 'next/link';
import { Check, Hand, X } from 'lucide-react';
import { toast } from 'sonner';
import { useApprovals, useDecideApproval } from '@/entities/run';
import { useCurrentWorkspace } from '@/entities/workspace';
import { copy } from '@/shared/lib/copy';
import { relativeTime } from '@/shared/lib/format';
import { Button } from '@/shared/ui/button';
import { Guarded } from '@/shared/ui/guarded';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover';
import { Skeleton } from '@/shared/ui/skeleton';
import { ErrorState } from '@/shared/ui/states';

export function ApprovalsButton() {
  const q = useApprovals('pending');
  const decide = useDecideApproval();
  const { can } = useCurrentWorkspace();
  const n = q.data?.length ?? 0;

  const act = (id: string, runId: string, approve: boolean) =>
    decide.mutate(
      { id, approve, runId },
      { onSuccess: () => toast.success(approve ? copy.toast.approved : copy.toast.rejected), onError: (e) => toast.error(e.message) },
    );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant={n > 0 ? 'warn' : 'outline'} className="h-[38px]" data-testid="approvals-button">
          <Hand aria-hidden /> {copy.topbar.approvals(n)}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="border-b px-4 py-3 font-semibold">승인이 필요한 작업</div>
        <div className="max-h-96 overflow-y-auto p-2">
          {q.isPending ? (
            <div className="space-y-2 p-2">
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
            </div>
          ) : q.isError ? (
            <ErrorState compact error={q.error} onRetry={() => void q.refetch()} />
          ) : n === 0 ? (
            <p className="text-muted p-6 text-center text-sm">기다리는 승인이 없습니다.</p>
          ) : (
            q.data!.map((a) => (
              <div key={a.id} className="hover:bg-surface rounded-md p-3">
                <Link href={`/runs/${a.runId}`} className="block">
                  <p className="text-sm font-medium">
                    {a.targetName} · {a.summary.title}
                  </p>
                  <p className="text-muted line-clamp-2 text-xs">{a.summary.message}</p>
                  <p className="text-muted mt-0.5 text-xs">{relativeTime(a.createdAt)}</p>
                </Link>
                <div className="mt-2 flex gap-2">
                  <Guarded allowed={can('approve')} reason={copy.common.adminOnly}>
                    <Button size="sm" onClick={() => act(a.id, a.runId, true)} disabled={decide.isPending}>
                      <Check aria-hidden /> 승인
                    </Button>
                  </Guarded>
                  <Guarded allowed={can('approve')} reason={copy.common.adminOnly}>
                    <Button size="sm" variant="outline" onClick={() => act(a.id, a.runId, false)} disabled={decide.isPending}>
                      <X aria-hidden /> 거부
                    </Button>
                  </Guarded>
                </div>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
