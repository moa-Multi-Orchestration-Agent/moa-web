'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { AlertTriangle, ArrowLeft, Play, Square, WifiOff } from 'lucide-react';
import { toast } from 'sonner';
import { isTerminal, useCancelRun, useRun, useRunEvents } from '@/entities/run';
import { useCurrentWorkspace } from '@/entities/workspace';
import { LazyContextPanel as ContextPanel } from '@/features/editor/context-panel/lazy';
import { isApiError } from '@/shared/lib/api-client';
import { copy } from '@/shared/lib/copy';
import { describeError } from '@/shared/lib/error-codes';
import { durationBetween, formatDateTime, formatDuration, formatNumber, formatUsd } from '@/shared/lib/format';
import { Button } from '@/shared/ui/button';
import { Guarded } from '@/shared/ui/guarded';
import { JsonViewer } from '@/shared/ui/json-viewer';
import { SectionCard } from '@/shared/ui/page-header';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/shared/ui/sheet';
import { Skeleton } from '@/shared/ui/skeleton';
import { EmptyState, ErrorState } from '@/shared/ui/states';
import { KindBadge, RunStatusBadge } from '@/shared/ui/status-badge';
import { Gantt } from './gantt';
import { RerunDialog } from './rerun-dialog';
import { RunApproval } from './run-approval';

const ThreeViewer = dynamic(() => import('@/shared/ui/three-viewer'), { ssr: false, loading: () => <Skeleton className="h-80 w-full" /> });

function ErrorBox({ code, detail }: { code: string; detail?: unknown }) {
  const e = describeError(code)!;
  return (
    <div role="alert" className="border-danger/30 bg-danger-soft/50 rounded-lg border p-4" data-testid="run-error">
      <p className="text-danger flex items-center gap-2 font-semibold">
        <AlertTriangle className="size-4" aria-hidden /> <code className="font-mono">{e.code}</code> {e.title}
      </p>
      {(detail as { message?: string } | null)?.message ? <p className="mt-1 text-sm">{(detail as { message: string }).message}</p> : null}
      {e.hint ? <p className="text-muted mt-1 text-sm">{e.hint}</p> : null}
    </div>
  );
}

export function RunDetailView({ id }: { id: string }) {
  const q = useRun(id);
  const live = !!q.data && !isTerminal(q.data.status);
  const { connection } = useRunEvents(live ? id : null);
  const cancel = useCancelRun();
  const { can } = useCurrentWorkspace();
  const [picked, setPicked] = useState<string | null>(null);
  const [rerun, setRerun] = useState(false);
  const [ctx, setCtx] = useState(false);

  if (q.isPending) return <div className="space-y-4 p-8"><Skeleton className="h-24" /><Skeleton className="h-96" /></div>;
  if (q.isError) {
    const nf = isApiError(q.error) && q.error.status === 404;
    return <div className="p-8">{nf ? <EmptyState title="실행을 찾을 수 없어요" description="다른 워크스페이스의 실행이거나 주소가 잘못되었습니다." action={<Button asChild><Link href="/runs">실행 로그로</Link></Button>} /> : <ErrorState error={q.error} onRetry={() => void q.refetch()} />}</div>;
  }
  const r = q.data!;
  const step = r.steps.find((s) => s.id === picked) ?? r.steps.find((s) => s.ok === false) ?? r.steps.find((s) => r.assets.some((a) => a.step_id === s.id)) ?? r.steps.at(-1) ?? null;
  const asset = step ? r.assets.find((a) => a.step_id === step.id) : null;
  const pending = r.approvals.find((a) => a.status === 'pending');
  const sum = copy.runs.summary;

  return (
    <div className="mx-auto max-w-[1320px] space-y-5 px-8 py-6">
      <Link href="/runs" className="text-muted hover:text-foreground inline-flex items-center gap-1 text-sm">
        <ArrowLeft className="size-4" aria-hidden /> {copy.runs.title}
      </Link>
      <header className="bg-card flex flex-wrap items-center gap-x-8 gap-y-3 rounded-lg border p-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <KindBadge kind={r.targetKind} />
            <h1 className="text-title truncate font-bold">{r.targetName}</h1>
          </div>
          <p className="text-muted mt-1 font-mono text-xs">{r.id}</p>
        </div>
        <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {(
            [
              [sum.status, <RunStatusBadge key="s" status={r.status} />],
              [sum.trigger, copy.status.trigger[r.trigger]],
              [sum.duration, formatDuration(durationBetween(r.startedAt, r.finishedAt))],
              [sum.tokens, formatNumber(r.tokensIn + r.tokensOut)],
              [sum.cost, formatUsd(r.costUsd)],
              [sum.started, formatDateTime(r.createdAt)],
            ] as const
          ).map(([k, v]) => (
            <div key={k}>
              <dt className="text-muted text-xs">{k}</dt>
              <dd className="font-semibold tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="ml-auto flex gap-2">
          {live ? (
            <span className="text-primary inline-flex items-center gap-1 text-xs font-semibold" role="status">
              {connection === 'polling' || connection === 'reconnecting' ? <><WifiOff className="size-3.5" aria-hidden /> 다시 연결 중</> : <>● {copy.runs.live}</>}
            </span>
          ) : null}
          <Button variant="outline" onClick={() => setCtx(true)} disabled={!r.contextSessionId}>
            {copy.runs.contextView}
          </Button>
          {live ? (
            <Guarded allowed={can('edit')} reason={copy.common.viewerReason}>
              <Button variant="outline" onClick={() => cancel.mutate(r.id, { onSuccess: () => toast.success('취소했습니다.'), onError: (e) => toast.error(e.message) })}>
                <Square aria-hidden /> {copy.runs.cancel}
              </Button>
            </Guarded>
          ) : null}
          <Guarded allowed={can('edit')} reason={copy.common.viewerReason}>
            <Button onClick={() => setRerun(true)} data-testid="rerun">
              <Play aria-hidden /> {copy.runs.rerun}
            </Button>
          </Guarded>
        </div>
      </header>
      {pending ? <RunApproval approval={pending} runId={r.id} /> : null}
      {r.status === 'failed' && r.errorCode ? <ErrorBox code={r.errorCode} detail={r.errorDetail} /> : null}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <SectionCard title={copy.runs.steps}>
          <Gantt steps={r.steps} selected={step?.id} onSelect={setPicked} />
        </SectionCard>
        <SectionCard title={step ? `${step.node_name ?? step.node_id}` : '단계'}>
          {!step ? (
            <p className="text-muted text-sm">{copy.runs.noStep}</p>
          ) : (
            <div className="space-y-4">
              <p className="text-muted text-xs">
                {step.node_type} · 시도 {step.attempt}회{step.model ? ` · ${step.model}` : ''} · {formatDuration(step.latency_ms)} · 토큰 {formatNumber(step.tokens_in + step.tokens_out)} · {formatUsd(step.cost_usd)}
              </p>
              {step.error_code ? <ErrorBox code={step.error_code} /> : null}
              {asset ? (
                <div>
                  <h3 className="mb-2 text-sm font-semibold">{copy.runs.asset3d}</h3>
                  <ThreeViewer url={asset.url} previewUrl={asset.preview_url} />
                  <p className="text-muted mt-1 text-xs">
                    {asset.format.toUpperCase()} · 폴리곤 {formatNumber(asset.poly_count)} · {Math.round((asset.bytes ?? 0) / 1024)}KB
                  </p>
                </div>
              ) : null}
              <div>
                <h3 className="mb-1.5 text-sm font-semibold">{copy.runs.input}</h3>
                <JsonViewer value={step.input} label="입력 JSON" />
              </div>
              <div>
                <h3 className="mb-1.5 text-sm font-semibold">{copy.runs.output}</h3>
                <JsonViewer value={step.output} label="출력 JSON" />
              </div>
            </div>
          )}
        </SectionCard>
      </div>
      {r.output ? (
        <SectionCard title="최종 출력">
          <JsonViewer value={r.output} label="최종 출력 JSON" />
        </SectionCard>
      ) : null}
      <RerunDialog run={r} open={rerun} onOpenChange={setRerun} />
      <Sheet open={ctx} onOpenChange={setCtx}>
        <SheetContent className="flex w-full flex-col p-0 sm:max-w-[560px]">
          <SheetHeader className="border-b">
            <SheetTitle>컨텍스트</SheetTitle>
          </SheetHeader>
          <ContextPanel className="min-h-0 flex-1" sessionId={r.contextSessionId} readOnly={!can('edit')} />
        </SheetContent>
      </Sheet>
    </div>
  );
}
