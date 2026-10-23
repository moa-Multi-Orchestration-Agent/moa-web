'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRun, useRunEvents, isTerminal } from '@/entities/run';
import { ContextPanel } from '@/features/editor/context-panel';
import { copy } from '@/shared/lib/copy';
import { formatTime } from '@/shared/lib/format';
import { Button } from '@/shared/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/shared/ui/sheet';
import { Skeleton } from '@/shared/ui/skeleton';
import { ErrorState } from '@/shared/ui/states';
import { RunStatusBadge } from '@/shared/ui/status-badge';
import { Gantt } from './gantt';
import { RerunDialog } from './rerun-dialog';
import { RunApproval } from './run-approval';

/** 실행 로그 오른쪽 요약 카드(Figma 10) */
export function RunPanel({ runId }: { runId: string | null }) {
  const q = useRun(runId);
  const live = !!q.data && !isTerminal(q.data.status);
  useRunEvents(live ? runId : null);
  const [ctxOpen, setCtxOpen] = useState(false);
  const [rerun, setRerun] = useState(false);

  if (!runId) return <p className="text-muted p-6 text-center text-sm">{copy.runs.pickHint}</p>;
  if (q.isPending) return <Skeleton className="m-5 h-80" />;
  if (q.isError) return <ErrorState className="m-5" error={q.error} onRetry={() => void q.refetch()} />;
  const r = q.data!;
  const pending = r.approvals.find((a) => a.status === 'pending');
  return (
    <div className="space-y-4 p-5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-mono text-base font-bold">{copy.runs.detail(r.id)}</h2>
          <p className="text-muted mt-0.5 text-sm">
            {r.targetName} · {copy.status.trigger[r.trigger]} · {formatTime(r.createdAt)}
          </p>
        </div>
        <RunStatusBadge status={r.status} />
      </div>
      {pending ? <RunApproval approval={pending} runId={r.id} /> : null}
      <section>
        <h3 className="mb-2 text-sm font-bold">{copy.runs.steps}</h3>
        <Gantt steps={r.steps} compact />
      </section>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => setCtxOpen(true)} disabled={!r.contextSessionId}>
          {copy.runs.contextView}
        </Button>
        {r.workflowId ? (
          <Button variant="outline" size="sm" asChild>
            <Link href={`/workflows/${r.workflowId}/edit`}>{copy.runs.openWorkflow}</Link>
          </Button>
        ) : null}
        <Button variant="ghost" size="sm" onClick={() => setRerun(true)}>
          {copy.runs.rerun}
        </Button>
        <Button variant="link" size="sm" asChild className="ml-auto">
          <Link href={`/runs/${r.id}`}>{copy.runs.openDetail}</Link>
        </Button>
      </div>
      <Sheet open={ctxOpen} onOpenChange={setCtxOpen}>
        <SheetContent className="flex w-full flex-col p-0 sm:max-w-[560px]">
          <SheetHeader className="border-b">
            <SheetTitle>컨텍스트 · {copy.runs.detail(r.id)}</SheetTitle>
            <SheetDescription>이 실행에서 모델에 들어간 블록입니다.</SheetDescription>
          </SheetHeader>
          <ContextPanel className="min-h-0 flex-1" sessionId={r.contextSessionId} readOnly />
        </SheetContent>
      </Sheet>
      <RerunDialog run={r} open={rerun} onOpenChange={setRerun} />
    </div>
  );
}
