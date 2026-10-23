'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ChevronDown, ChevronUp, Square, WifiOff } from 'lucide-react';
import { toast } from 'sonner';
import { isTerminal, useDecideApproval, useRun } from '@/entities/run';
import { useCurrentWorkspace } from '@/entities/workspace';
import { formatDuration, formatNumber, formatUsd } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import { Guarded } from '@/shared/ui/guarded';
import { EmptyState } from '@/shared/ui/states';
import { RunStatusBadge } from '@/shared/ui/status-badge';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { useEditorStore } from './store';
import type { useEditorRun } from './use-editor-run';

type RunApi = ReturnType<typeof useEditorRun>;
const pad = (n: number) => String(n).padStart(2, '0');
const hms = (ts: number) => {
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};
const TABS = [
  ['log', '로그'],
  ['io', '노드별 입출력'],
  ['cost', '토큰 · 비용'],
] as const;

function LogView({ lines, dropped }: { lines: RunApi['lines']; dropped: number }) {
  const parent = useRef<HTMLDivElement>(null);
  const v = useVirtualizer({ count: lines.length, getScrollElement: () => parent.current, estimateSize: () => 22, overscan: 12 });
  useEffect(() => {
    if (lines.length) v.scrollToIndex(lines.length - 1, { align: 'end' });
  }, [lines.length, v]);
  return (
    <div ref={parent} className="h-full overflow-auto font-mono text-xs" role="log" aria-live="polite" aria-label="실행 로그">
      {dropped ? <p className="text-muted px-3 py-1">앞의 로그 {dropped}줄은 메모리 상한(5000줄)으로 생략했습니다.</p> : null}
      <div style={{ height: v.getTotalSize(), position: 'relative' }}>
        {v.getVirtualItems().map((item) => {
          const l = lines[item.index]!;
          return (
            <div
              key={l.id}
              ref={v.measureElement}
              data-index={item.index}
              className={cn('absolute left-0 w-full px-3 py-0.5 whitespace-pre-wrap', l.kind === 'error' && 'text-danger', l.kind === 'ok' && 'text-success', l.kind === 'approval' && 'text-warning', (l.kind === 'status' || l.kind === 'context') && 'text-muted')}
              style={{ transform: `translateY(${item.start}px)` }}
            >
              <span className="text-muted mr-2">{hms(l.ts)}</span>
              {l.kind === 'text' ? <span className="text-foreground/80">  {l.text}</span> : l.text}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function RunConsole({ r }: { r: RunApi }) {
  const [open, setOpen] = useState(true);
  const [tab, setTab] = useState<(typeof TABS)[number][0]>('log');
  const detail = useRun(r.runId);
  const decide = useDecideApproval();
  const { can } = useCurrentWorkspace();
  const nodes = useEditorStore((s) => s.nodes);
  const name = (id: string) => nodes.find((n) => n.id === id)?.data.name ?? id;
  const steps = detail.data?.steps ?? [];
  const total = steps.reduce((acc, s) => ({ tin: acc.tin + s.tokens_in, tout: acc.tout + s.tokens_out, cost: acc.cost + s.cost_usd }), { tin: 0, tout: 0, cost: 0 });

  const act = (approve: boolean) =>
    r.approval && decide.mutate({ id: r.approval.id, approve, runId: r.runId ?? undefined }, { onSuccess: () => toast.success(approve ? '승인했습니다. 이어서 실행합니다.' : '거부했습니다.'), onError: (e) => toast.error(e.message) });

  return (
    <section className={cn('bg-background flex shrink-0 flex-col border-t', open ? 'h-[260px]' : 'h-10')} aria-label="실행 콘솔">
      <div className="flex h-10 shrink-0 items-center gap-3 border-b px-4">
        <button type="button" onClick={() => setOpen((o) => !o)} className="flex items-center gap-1 text-sm font-bold" aria-expanded={open}>
          {open ? <ChevronDown className="size-4" aria-hidden /> : <ChevronUp className="size-4" aria-hidden />} 실행 로그
        </button>
        <span className="text-muted text-xs">마지막 테스트 · 실시간</span>
        {r.status ? <RunStatusBadge status={r.status} /> : null}
        {r.connection === 'reconnecting' || r.connection === 'polling' ? (
          <span role="status" className="text-warning inline-flex items-center gap-1 text-xs">
            <WifiOff className="size-3.5" aria-hidden /> {r.connection === 'polling' ? '연결 불안정 · 2초마다 새로 고침' : '연결이 끊겨 다시 연결하는 중…'}
          </span>
        ) : null}
        {open ? (
          <div role="tablist" aria-label="콘솔 탭" className="ml-4 flex gap-3">
            {TABS.map(([k, l]) => (
              <button key={k} role="tab" type="button" aria-selected={tab === k} onClick={() => setTab(k)} className={cn('text-xs', tab === k ? 'font-bold' : 'text-muted')}>
                {l}
              </button>
            ))}
          </div>
        ) : null}
        <div className="ml-auto flex items-center gap-2">
          {r.status && !isTerminal(r.status) ? (
            <Button size="xs" variant="outline" onClick={r.stop} aria-label="실행 취소">
              <Square aria-hidden /> 취소
            </Button>
          ) : null}
          {r.runId ? (
            <Link href={`/runs/${r.runId}`} className="text-primary text-xs font-semibold hover:underline">
              전체 실행 기록 →
            </Link>
          ) : null}
        </div>
      </div>
      {r.approval ? (
        <div role="alert" className="bg-warning-soft flex items-center gap-3 px-4 py-2 text-sm">
          <span className="text-warning font-semibold">✋ {r.approval.title}</span>
          <span className="text-muted min-w-0 flex-1 truncate">{r.approval.message}</span>
          <Guarded allowed={can('approve')} reason="관리자 이상만 승인할 수 있습니다.">
            <Button size="xs" onClick={() => act(true)} disabled={decide.isPending} data-testid="console-approve">
              승인
            </Button>
          </Guarded>
          <Guarded allowed={can('approve')} reason="관리자 이상만 승인할 수 있습니다.">
            <Button size="xs" variant="outline" onClick={() => act(false)} disabled={decide.isPending}>
              거부
            </Button>
          </Guarded>
        </div>
      ) : null}
      {open ? (
        <div className="min-h-0 flex-1">
          {!r.runId ? (
            <div className="p-4">
              <EmptyState className="py-6" title="아직 테스트 실행이 없어요" description="상단의 '테스트 실행'(⌘Enter)으로 지금 캔버스를 실행해 보세요." />
            </div>
          ) : tab === 'log' ? (
            <LogView lines={r.lines} dropped={r.dropped} />
          ) : tab === 'io' ? (
            <div className="h-full overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>노드</TableHead>
                    <TableHead>상태</TableHead>
                    <TableHead>입력</TableHead>
                    <TableHead>출력</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {steps.map((s) => (
                    <TableRow key={s.id} className="align-top">
                      <TableCell className="font-medium">{name(s.node_id)}</TableCell>
                      <TableCell>{s.ok === null ? '실행 중' : s.ok ? '완료' : `실패 ${s.error_code ?? ''}`}</TableCell>
                      <TableCell className="max-w-[260px]">
                        <code className="line-clamp-3 font-mono text-[11px] break-all">{JSON.stringify(s.input)}</code>
                      </TableCell>
                      <TableCell className="max-w-[360px]">
                        <code className="line-clamp-3 font-mono text-[11px] break-all">{JSON.stringify(s.output)}</code>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="h-full overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>노드</TableHead>
                    <TableHead>모델</TableHead>
                    <TableHead className="text-right">시간</TableHead>
                    <TableHead className="text-right">입력 토큰</TableHead>
                    <TableHead className="text-right">출력 토큰</TableHead>
                    <TableHead className="text-right">비용</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {steps.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>{name(s.node_id)}</TableCell>
                      <TableCell className="text-muted">{s.model ?? '—'}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatDuration(s.latency_ms)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumber(s.tokens_in)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumber(s.tokens_out)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatUsd(s.cost_usd)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={3} className="font-semibold">
                      합계
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(total.tin)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(total.tout)}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums" data-testid="run-total-cost">
                      {formatUsd(total.cost)}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
