'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useAgents } from '@/entities/agent';
import { useRuns, type RunListParams } from '@/entities/run';
import { useSearchState } from '@/shared/hooks/use-search-state';
import { copy } from '@/shared/lib/copy';
import { durationBetween, formatDuration, formatNumber, formatTime, formatUsd, relativeTime } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import { ChipGroup } from '@/shared/ui/chips';
import { PageContainer, PageHeader } from '@/shared/ui/page-header';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { EmptyState, ErrorState, ListSkeleton } from '@/shared/ui/states';
import { KindBadge, RunStatusBadge } from '@/shared/ui/status-badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { RunPanel } from './run-panel';

function periodFrom(p: string) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (p === 'today') return d.toISOString();
  if (p === '7d') return new Date(d.getTime() - 6 * 86_400_000).toISOString();
  if (p === '30d') return new Date(d.getTime() - 29 * 86_400_000).toISOString();
  return undefined;
}

export function RunsView() {
  const [s, set] = useSearchState({ status: 'all', kind: 'all', period: '30d', trigger: 'all', agent: 'all', selected: '' });
  const params: RunListParams = {
    status: s.status === 'all' ? undefined : s.status,
    kind: s.kind === 'all' ? undefined : (s.kind as 'agent' | 'workflow'),
    from: periodFrom(s.period),
    trigger: s.trigger === 'all' ? undefined : s.trigger,
    agent_id: s.agent === 'all' ? undefined : s.agent,
  };
  const q = useRuns(params);
  const agents = useAgents({ limit: 50 });
  const counts = q.counts;
  const statusOptions = useMemo(
    () => [
      { value: 'all', label: copy.runs.statusAll },
      { value: 'waiting_approval', label: `${copy.status.run.waiting_approval}${counts.waiting_approval ? ` ${counts.waiting_approval}` : ''}` },
      { value: 'running', label: copy.status.run.running },
      { value: 'failed', label: copy.status.run.failed },
      { value: 'succeeded', label: copy.status.run.succeeded },
      { value: 'canceled', label: copy.status.run.canceled },
    ],
    [counts.waiting_approval],
  );
  const selected = s.selected || q.items[0]?.id || null;
  const c = copy.runs.columns;

  const sel = (v: string, onChange: (v: string) => void, opts: Record<string, string>, label: string, extra: { value: string; label: string }[] = []) => (
    <Select value={v} onValueChange={onChange}>
      <SelectTrigger className="h-9 w-auto min-w-32" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(opts).map(([k, l]) => (
          <SelectItem key={k} value={k}>
            {l}
          </SelectItem>
        ))}
        {extra.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <PageContainer className="max-w-[1320px]">
      <PageHeader title={copy.runs.title} description={copy.runs.subtitle} />
      <div className="flex flex-wrap items-center gap-2">
        <ChipGroup label="상태" value={s.status} onChange={(v) => set({ status: v, selected: '' })} options={statusOptions} />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {sel(s.kind, (v) => set({ kind: v, selected: '' }), copy.runs.kind, '종류')}
          {sel(s.trigger, (v) => set({ trigger: v, selected: '' }), { all: copy.runs.triggerAll, ...copy.status.trigger }, '경로')}
          {sel(s.agent, (v) => set({ agent: v, selected: '' }), { all: copy.runs.agentAll }, '에이전트', agents.items.map((a) => ({ value: a.id, label: a.name })))}
          {sel(s.period, (v) => set({ period: v, selected: '' }), copy.runs.period, '기간')}
          <Button variant="outline" asChild>
            <Link href="/settings?tab=budget">{copy.runs.costReport}</Link>
          </Button>
        </div>
      </div>
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="bg-card overflow-hidden rounded-lg border">
          {q.isPending ? (
            <div className="p-4">
              <ListSkeleton rows={8} />
            </div>
          ) : q.isError ? (
            <div className="p-4">
              <ErrorState error={q.error} onRetry={() => void q.refetch()} />
            </div>
          ) : q.items.length === 0 ? (
            <div className="p-4">
              <EmptyState title={copy.runs.empty} description={copy.runs.emptyBody} />
            </div>
          ) : (
            <>
              <Table>
                <TableHeader className="bg-surface">
                  <TableRow>
                    <TableHead>{c.id}</TableHead>
                    <TableHead>{c.target}</TableHead>
                    <TableHead>{c.trigger}</TableHead>
                    <TableHead>{c.status}</TableHead>
                    <TableHead className="text-right">{c.duration}</TableHead>
                    <TableHead className="text-right">{c.tokens}</TableHead>
                    <TableHead className="text-right">{c.cost}</TableHead>
                    <TableHead>{c.started}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {q.items.map((r) => (
                    <TableRow key={r.id} className={cn('cursor-pointer', selected === r.id && 'bg-primary-soft/60')} onClick={() => set({ selected: r.id })} data-testid="run-row">
                      <TableCell className="font-mono text-xs">
                        <Link href={`/runs/${r.id}`} onClick={(e) => e.stopPropagation()} className="hover:underline">
                          run_{r.id.slice(-6)}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <button type="button" onClick={() => set({ selected: r.id })} className="flex items-center gap-2 text-left" aria-label={`${r.targetName} 실행 요약 보기`}>
                          <KindBadge kind={r.targetKind} />
                          <span className="max-w-[180px] truncate">{r.targetName}</span>
                        </button>
                      </TableCell>
                      <TableCell>{copy.status.trigger[r.trigger]}</TableCell>
                      <TableCell>
                        <RunStatusBadge status={r.status} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatDuration(durationBetween(r.startedAt, r.finishedAt))}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumber(r.tokensIn + r.tokensOut)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatUsd(r.costUsd)}</TableCell>
                      <TableCell className="text-muted" title={r.createdAt}>
                        {s.period === 'today' ? formatTime(r.createdAt) : relativeTime(r.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {q.hasNextPage ? (
                <div className="border-t p-3 text-center">
                  <Button variant="outline" size="sm" onClick={() => void q.fetchNextPage()} disabled={q.isFetchingNextPage}>
                    {q.isFetchingNextPage ? copy.common.loading : copy.studio.loadMore}
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </div>
        <aside className="bg-card sticky top-4 rounded-lg border" aria-label="실행 요약">
          <RunPanel runId={selected} />
        </aside>
      </div>
    </PageContainer>
  );
}
