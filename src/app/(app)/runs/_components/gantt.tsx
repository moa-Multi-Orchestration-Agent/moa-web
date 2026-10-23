'use client';

import type { RunStepRow } from '@/entities/run';
import { modelLabel } from '@/entities/agent';
import { copy } from '@/shared/lib/copy';
import { formatDuration } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import { Badge } from '@/shared/ui/badge';

const KIND_LABEL: Record<string, string> = { skill: '스킬', workflow: '워크플로', model: '모델', node: '노드' };

function statusOf(s: RunStepRow) {
  if (s.ok === null) return s.node_type === 'approval' ? { t: '승인 대기', v: 'orange' as const, bar: 'bg-warning' } : { t: '실행 중', v: 'blue' as const, bar: 'bg-primary animate-pulse' };
  return s.ok ? { t: '완료', v: 'green' as const, bar: 'bg-primary' } : { t: '실패', v: 'red' as const, bar: 'bg-danger' };
}

/** 노드 타임라인(간트). 막대 위치 = 시작 시각, 길이 = 소요 시간 */
export function Gantt({ steps, selected, onSelect, compact }: { steps: RunStepRow[]; selected?: string | null; onSelect?: (id: string) => void; compact?: boolean }) {
  if (!steps.length) return <p className="text-muted py-4 text-center text-sm">아직 실행된 단계가 없어요.</p>;
  const t0 = Math.min(...steps.map((s) => new Date(s.started_at).getTime()));
  const now = Date.now();
  const lastDone = Math.max(t0 + 1, ...steps.filter((s) => s.finished_at).map((s) => new Date(s.finished_at!).getTime()));
  // 승인 대기처럼 사람을 기다리는 단계는 축을 늘리지 않게 짧게 그린다
  const endOf = (s: RunStepRow) => (s.finished_at ? new Date(s.finished_at).getTime() : s.node_type === 'approval' ? Math.max(new Date(s.started_at).getTime(), lastDone) + Math.max(500, (lastDone - t0) * 0.12) : now);
  const t1 = Math.max(...steps.map(endOf), t0 + 1);
  const span = t1 - t0;
  return (
    <ol className="space-y-1" aria-label="노드 타임라인">
      {steps.map((s) => {
        const st = statusOf(s);
        const start = new Date(s.started_at).getTime() - t0;
        const end = endOf(s) - t0;
        const left = (start / span) * 100;
        const width = Math.max(1.5, ((end - start) / span) * 100);
        const Row = onSelect ? 'button' : 'div';
        return (
          <li key={s.id}>
            <Row
              {...(onSelect ? { type: 'button' as const, onClick: () => onSelect(s.id), 'aria-pressed': selected === s.id } : {})}
              className={cn('grid w-full items-center gap-3 rounded-md px-2 py-1.5 text-left text-sm', compact ? 'grid-cols-[150px_1fr_72px]' : 'grid-cols-[minmax(160px,220px)_1fr_80px_72px]', onSelect && 'hover:bg-surface', selected === s.id && 'bg-primary-soft')}
            >
              <span className="flex min-w-0 items-center gap-1.5">
                {s.kind && s.kind !== 'node' ? <Badge variant={s.kind === 'workflow' ? 'dark' : 'gray'}>{KIND_LABEL[s.kind]}</Badge> : null}
                <span className="truncate font-medium">{s.node_name ?? s.node_id}</span>
                {!compact && s.attempt > 1 ? <Badge variant="orange">{copy.runs.attempts(s.attempt)}</Badge> : null}
                {!compact && s.fallback_used && s.model ? <Badge variant="blue">{copy.runs.fallback(modelLabel(s.model))}</Badge> : null}
              </span>
              <span className="bg-surface-strong relative h-2.5 rounded-full" aria-hidden>
                <span className={cn('absolute top-0 h-full rounded-full', st.bar)} style={{ left: `${left}%`, width: `${Math.min(width, 100 - left)}%` }} />
              </span>
              {!compact ? <span className="text-muted text-right text-xs tabular-nums">{formatDuration(s.latency_ms)}</span> : null}
              <Badge variant={st.v} className="justify-self-end">
                {st.t}
              </Badge>
            </Row>
          </li>
        );
      })}
    </ol>
  );
}
