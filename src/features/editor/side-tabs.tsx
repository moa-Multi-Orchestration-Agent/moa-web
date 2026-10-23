'use client';

import Link from 'next/link';
import { useEndpoints } from '@/entities/endpoint';
import { useRuns } from '@/entities/run';
import type { WorkflowDetail } from '@/entities/workflow';
import { copy } from '@/shared/lib/copy';
import { durationBetween, formatDateTime, formatDuration, formatUsd } from '@/shared/lib/format';
import { Badge } from '@/shared/ui/badge';
import { SectionCard } from '@/shared/ui/page-header';
import { EmptyState, ErrorState, ListSkeleton } from '@/shared/ui/states';
import { RunStatusBadge } from '@/shared/ui/status-badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';

export function WorkflowRunsTab({ workflowId }: { workflowId: string }) {
  const q = useRuns({ workflow_id: workflowId, limit: 30 });
  return (
    <div className="mx-auto w-full max-w-5xl p-6">
      <SectionCard title="실행 기록" bodyClassName="p-0 pt-3">
        {q.isPending ? (
          <div className="p-5"><ListSkeleton rows={4} /></div>
        ) : q.isError ? (
          <div className="p-5"><ErrorState compact error={q.error} onRetry={() => void q.refetch()} /></div>
        ) : q.items.length === 0 ? (
          <div className="p-5"><EmptyState title="실행 기록이 없어요" description="설계 탭에서 테스트 실행을 해 보세요." /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>상태</TableHead>
                <TableHead>경로</TableHead>
                <TableHead>소요</TableHead>
                <TableHead>비용</TableHead>
                <TableHead>시작</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {q.items.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Link href={`/runs/${r.id}`} aria-label={`실행 ${r.id.slice(-6)} 상세`}>
                      <RunStatusBadge status={r.status} />
                    </Link>
                  </TableCell>
                  <TableCell>{copy.status.trigger[r.trigger]}</TableCell>
                  <TableCell className="tabular-nums">{formatDuration(durationBetween(r.startedAt, r.finishedAt))}</TableCell>
                  <TableCell className="tabular-nums">{formatUsd(r.costUsd)}</TableCell>
                  <TableCell className="text-muted">{formatDateTime(r.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionCard>
    </div>
  );
}

export function WorkflowDeployTab({ wf }: { wf: WorkflowDetail }) {
  const eps = useEndpoints();
  const agentIds = new Set(wf.agents.map((a) => a.id));
  const mine = (eps.data ?? []).filter((e) => agentIds.has(e.agentId));
  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 p-6">
      <p className="bg-primary-soft text-primary rounded-lg px-4 py-3 text-sm">
        워크플로는 연결된 에이전트를 통해 배포됩니다(엔드포인트는 에이전트 단위, design.md endpoints.agent_id). 배포 시점의 워크플로 버전이 고정됩니다.
      </p>
      <SectionCard title="연결된 에이전트의 엔드포인트">
        {eps.isPending ? (
          <ListSkeleton rows={2} />
        ) : eps.isError ? (
          <ErrorState compact error={eps.error} onRetry={() => void eps.refetch()} />
        ) : wf.agents.length === 0 ? (
          <EmptyState title="연결된 에이전트가 없어요" description="에이전트 빌더에서 이 워크플로를 연결하면 배포할 수 있습니다." action={<Link href="/studio/new?type=agent" className="text-primary text-sm font-semibold">새 에이전트 만들기 →</Link>} />
        ) : mine.length === 0 ? (
          <EmptyState title="아직 배포하지 않았어요" description={`${wf.agents.map((a) => a.name).join(', ')}을(를) 배포하면 여기 보입니다.`} action={<Link href={`/deploy?new=1&agent=${wf.agents[0]!.id}`} className="text-primary text-sm font-semibold">배포하기 →</Link>} />
        ) : (
          <ul className="divide-y">
            {mine.map((e) => (
              <li key={e.id} className="flex items-center gap-3 py-3 text-sm">
                <Badge variant={e.isActive ? 'green' : 'gray'}>{e.isActive ? `배포됨 · v${e.version}` : '꺼짐'}</Badge>
                <Link href={`/deploy/${e.id}`} className="font-mono hover:underline">{e.url}</Link>
                <span className="text-muted ml-auto">{e.agentName}</span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
