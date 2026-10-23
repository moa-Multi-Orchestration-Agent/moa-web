'use client';

import Link from 'next/link';
import { Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { useApprovals, useDecideApproval } from '@/entities/run';
import { useTemplates } from '@/entities/template';
import { useCurrentWorkspace } from '@/entities/workspace';
import { copy } from '@/shared/lib/copy';
import { relativeTime } from '@/shared/lib/format';
import { Button } from '@/shared/ui/button';
import { Guarded } from '@/shared/ui/guarded';
import { SectionCard } from '@/shared/ui/page-header';
import { EmptyState, ErrorState, ListSkeleton } from '@/shared/ui/states';

const RECOMMENDED = ['tpl-22', 'tpl-05', 'tpl-19'];

export function RecommendedTemplates() {
  const q = useTemplates();
  const items = (q.data ?? []).filter((t) => RECOMMENDED.includes(t.id)).sort((a, b) => RECOMMENDED.indexOf(a.id) - RECOMMENDED.indexOf(b.id));
  return (
    <SectionCard
      title={copy.home.templates}
      actions={
        <Link href="/templates" className="text-primary text-sm hover:underline">
          {copy.home.moreTemplates}
        </Link>
      }
      bodyClassName="pt-3"
    >
      {q.isPending ? (
        <ListSkeleton rows={3} />
      ) : q.isError ? (
        <ErrorState compact error={q.error} onRetry={() => void q.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState title="추천할 템플릿이 없어요" />
      ) : (
        <ul className="space-y-2.5">
          {items.map((t) => (
            <li key={t.id}>
              <Link href={`/templates?preview=${t.id}`} className="hover:border-primary/50 flex items-center gap-3 rounded-lg border p-3">
                <span aria-hidden className="bg-surface flex size-11 items-center justify-center rounded-md border border-dashed text-xl">
                  {t.icon}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{t.name}</span>
                  <span className="text-muted block text-xs">
                    {t.kind === 'agent' ? `에이전트 · 스킬 ${t.skills.length}개` : `워크플로 · 노드 ${t.nodeCount}개`}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

export function PendingApprovals() {
  const q = useApprovals('pending');
  const decide = useDecideApproval();
  const { can } = useCurrentWorkspace();
  const act = (id: string, runId: string, approve: boolean) =>
    decide.mutate({ id, approve, runId }, { onSuccess: () => toast.success(approve ? copy.toast.approved : copy.toast.rejected), onError: (e) => toast.error(e.message) });

  return (
    <SectionCard title={copy.home.approvals} bodyClassName="pt-3">
      {q.isPending ? (
        <ListSkeleton rows={2} />
      ) : q.isError ? (
        <ErrorState compact error={q.error} onRetry={() => void q.refetch()} />
      ) : !q.data?.length ? (
        <p className="text-muted py-4 text-center text-sm">{copy.home.noApprovals}</p>
      ) : (
        <ul className="space-y-2">
          {q.data.map((a) => (
            <li key={a.id} className="bg-warning-soft/60 rounded-md border border-[color:var(--warning)]/20 p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm">
                  <span className="font-semibold">{a.targetName}</span> · {a.summary.title} 승인 대기
                </p>
                <Link href={`/runs/${a.runId}`} className="text-primary shrink-0 text-sm hover:underline">
                  확인 →
                </Link>
              </div>
              <p className="text-muted mt-0.5 text-xs">{relativeTime(a.createdAt)} 요청</p>
              <div className="mt-2 flex gap-2">
                <Guarded allowed={can('approve')} reason={copy.common.adminOnly}>
                  <Button size="sm" onClick={() => act(a.id, a.runId, true)} disabled={decide.isPending}>
                    <Check aria-hidden /> 바로 승인
                  </Button>
                </Guarded>
                <Guarded allowed={can('approve')} reason={copy.common.adminOnly}>
                  <Button size="sm" variant="outline" onClick={() => act(a.id, a.runId, false)} disabled={decide.isPending}>
                    <X aria-hidden /> 거부
                  </Button>
                </Guarded>
              </div>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
