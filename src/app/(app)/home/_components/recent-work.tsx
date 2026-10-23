'use client';

import Link from 'next/link';
import { modelLabel, useAgents } from '@/entities/agent';
import { TRIGGER_LABEL, useWorkflows } from '@/entities/workflow';
import { copy } from '@/shared/lib/copy';
import { relativeTime } from '@/shared/lib/format';
import { Badge } from '@/shared/ui/badge';
import { SectionCard } from '@/shared/ui/page-header';
import { EmptyState, ErrorState, ListSkeleton } from '@/shared/ui/states';
import { KindBadge } from '@/shared/ui/status-badge';

interface Row {
  id: string;
  kind: 'agent' | 'workflow';
  icon: string;
  name: string;
  meta: string;
  href: string;
  updatedAt: string;
  badge: { label: string; variant: 'gray' | 'green' | 'blue' | 'orange' };
}

export function RecentWork() {
  const agents = useAgents({ limit: 5 });
  const workflows = useWorkflows({ limit: 5 });
  const loading = agents.isPending || workflows.isPending;
  const error = agents.error ?? workflows.error;

  const rows: Row[] = [
    ...agents.items.map((a) => ({
      id: a.id,
      kind: 'agent' as const,
      icon: a.icon ?? '🤖',
      name: a.name,
      meta: a.apiOnly ? '마켓 구매 · API 전용' : `${modelLabel(a.model)} · 스킬 ${a.skillCount}개 · 워크플로 ${a.workflowCount}개`,
      href: `/agents/${a.id}`,
      updatedAt: a.updatedAt,
      badge: a.listed ? { label: '마켓 판매 중', variant: 'blue' as const } : a.endpointCount ? { label: '배포됨', variant: 'green' as const } : a.purchased ? { label: '구매함', variant: 'orange' as const } : { label: a.latestVersion ? `초안 v${a.latestVersion}` : '초안', variant: 'gray' as const },
    })),
    ...workflows.items.map((w) => ({
      id: w.id,
      kind: 'workflow' as const,
      icon: '⛓️',
      name: w.name,
      meta: `${TRIGGER_LABEL[w.trigger] ?? w.trigger} · 노드 ${w.nodeCount}개`,
      href: `/workflows/${w.id}/edit`,
      updatedAt: w.updatedAt,
      badge: w.listed ? { label: '마켓 판매 중', variant: 'blue' as const } : w.deployed ? { label: '배포됨', variant: 'green' as const } : { label: w.latestVersion ? `초안 v${w.latestVersion}` : '초안', variant: 'gray' as const },
    })),
  ]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 5);

  return (
    <SectionCard
      title={copy.home.recentWork}
      actions={
        <Link href="/studio" className="text-primary text-sm hover:underline">
          {copy.home.viewStudio}
        </Link>
      }
      bodyClassName="pt-2"
    >
      {loading ? (
        <ListSkeleton rows={5} />
      ) : error ? (
        <ErrorState compact error={error} onRetry={() => void Promise.all([agents.refetch(), workflows.refetch()])} />
      ) : rows.length === 0 ? (
        <EmptyState title="아직 작업이 없어요" description={copy.home.emptyWork} />
      ) : (
        <ul className="divide-y">
          {rows.map((r) => (
            <li key={`${r.kind}-${r.id}`}>
              <Link href={r.href} className="hover:bg-surface -mx-2 flex items-center gap-3 rounded-md px-2 py-3">
                <span aria-hidden className="bg-surface flex size-9 items-center justify-center rounded-md border text-lg">
                  {r.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <KindBadge kind={r.kind} />
                    <span className="truncate font-semibold">{r.name}</span>
                  </span>
                  <span className="text-muted mt-0.5 block truncate text-xs">
                    {r.meta} · {relativeTime(r.updatedAt)} 수정
                  </span>
                </span>
                <Badge variant={r.badge.variant}>{r.badge.label}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
