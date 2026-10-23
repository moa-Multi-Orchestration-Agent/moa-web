'use client';

import Link from 'next/link';
import { Plus } from 'lucide-react';
import { useEndpoints } from '@/entities/endpoint';
import { useRuns } from '@/entities/run';
import { copy } from '@/shared/lib/copy';
import { durationBetween, formatDateTime, formatDuration, formatNumber, formatUsd } from '@/shared/lib/format';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { CopyButton } from '@/shared/ui/copy-button';
import { Guarded } from '@/shared/ui/guarded';
import { SectionCard } from '@/shared/ui/page-header';
import { EmptyState, ErrorState, ListSkeleton } from '@/shared/ui/states';
import { RunStatusBadge } from '@/shared/ui/status-badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';

export function AgentDeployTab({ agentId, canDeploy, reason }: { agentId: string; canDeploy: boolean; reason: string }) {
  const q = useEndpoints();
  const mine = (q.data ?? []).filter((e) => e.agentId === agentId);
  return (
    <div className="mx-auto max-w-4xl space-y-4 p-6">
      <SectionCard
        title="이 에이전트의 엔드포인트"
        actions={
          <Guarded allowed={canDeploy} reason={reason}>
            <Button asChild={canDeploy} size="sm">
              {canDeploy ? (
                <Link href={`/deploy?new=1&agent=${agentId}`}>
                  <Plus aria-hidden /> 새 배포
                </Link>
              ) : (
                <span>새 배포</span>
              )}
            </Button>
          </Guarded>
        }
      >
        {q.isPending ? (
          <ListSkeleton rows={2} />
        ) : q.isError ? (
          <ErrorState compact error={q.error} onRetry={() => void q.refetch()} />
        ) : mine.length === 0 ? (
          <EmptyState title="아직 배포하지 않았어요" description="배포하면 API · 채팅 위젯 · 슬래시 명령으로 이 에이전트를 부를 수 있습니다." />
        ) : (
          <ul className="divide-y">
            {mine.map((e) => (
              <li key={e.id} className="flex items-center gap-3 py-3">
                <Badge variant={e.isActive ? 'green' : 'gray'}>{e.isActive ? `배포됨 · v${e.version}` : '꺼짐'}</Badge>
                <Link href={`/deploy/${e.id}`} className="font-mono text-sm hover:underline">
                  {e.url}
                </Link>
                <CopyButton value={e.url} iconOnly label="URL 복사" variant="ghost" />
                <span className="text-muted ml-auto text-xs">
                  {e.mode === 'sync' ? '동기' : '비동기'} · 최근 7일 {formatNumber(e.callCount7d)}회
                </span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}

export function AgentLogsTab({ agentId }: { agentId: string }) {
  const q = useRuns({ agent_id: agentId, limit: 20 });
  return (
    <div className="mx-auto max-w-5xl space-y-4 p-6">
      <SectionCard title="최근 실행" actions={<Link href={`/runs?agent=${agentId}`} className="text-primary text-sm hover:underline">실행 로그에서 보기 →</Link>} bodyClassName="p-0 pt-3">
        {q.isPending ? (
          <div className="p-5">
            <ListSkeleton rows={4} />
          </div>
        ) : q.isError ? (
          <div className="p-5">
            <ErrorState compact error={q.error} onRetry={() => void q.refetch()} />
          </div>
        ) : q.items.length === 0 ? (
          <div className="p-5">
            <EmptyState title="실행 기록이 없어요" description="테스트 대화를 하면 여기에 쌓입니다." />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>상태</TableHead>
                <TableHead>경로</TableHead>
                <TableHead>소요</TableHead>
                <TableHead>토큰</TableHead>
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
                  <TableCell className="tabular-nums">{formatNumber(r.tokensIn + r.tokensOut)}</TableCell>
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
