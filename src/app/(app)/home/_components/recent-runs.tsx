'use client';

import Link from 'next/link';
import { useRuns } from '@/entities/run';
import { copy } from '@/shared/lib/copy';
import { durationBetween, formatDuration, formatUsd, relativeTime } from '@/shared/lib/format';
import { SectionCard } from '@/shared/ui/page-header';
import { EmptyState, ErrorState, ListSkeleton } from '@/shared/ui/states';
import { KindBadge, RunStatusBadge } from '@/shared/ui/status-badge';

export function RecentRuns() {
  const q = useRuns({ limit: 5 });
  const rows = q.items.slice(0, 5);
  return (
    <SectionCard
      title={copy.home.recentRuns}
      actions={
        <Link href="/runs" className="text-primary text-sm hover:underline">
          {copy.home.viewRuns}
        </Link>
      }
      bodyClassName="pt-2"
    >
      {q.isPending ? (
        <ListSkeleton rows={5} />
      ) : q.isError ? (
        <ErrorState compact error={q.error} onRetry={() => void q.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState title="실행 기록 없음" description={copy.home.emptyRuns} />
      ) : (
        <ul className="divide-y">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`/runs/${r.id}`} className="hover:bg-surface -mx-2 flex items-center gap-3 rounded-md px-2 py-2.5 text-sm">
                <RunStatusBadge status={r.status} className="w-[88px] justify-start" />
                <KindBadge kind={r.targetKind} />
                <span className="min-w-0 flex-1 truncate font-medium">{r.targetName}</span>
                <span className="text-muted w-16 text-right text-xs tabular-nums">{formatDuration(durationBetween(r.startedAt, r.finishedAt))}</span>
                <span className="text-muted w-16 text-right text-xs tabular-nums">{formatUsd(r.costUsd)}</span>
                <span className="text-muted w-20 text-right text-xs">{relativeTime(r.createdAt)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
