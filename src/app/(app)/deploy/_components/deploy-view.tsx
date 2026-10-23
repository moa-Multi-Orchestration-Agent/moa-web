'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useEndpoints, useUpdateEndpoint } from '@/entities/endpoint';
import { useWorkflows } from '@/entities/workflow';
import { useCurrentWorkspace } from '@/entities/workspace';
import { ApiKeysCard } from '@/features/deploy/api-keys-card';

import { useSearchState } from '@/shared/hooks/use-search-state';
import { copy } from '@/shared/lib/copy';
import { formatNumber, relativeTime } from '@/shared/lib/format';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Guarded } from '@/shared/ui/guarded';
import { LineTabs } from '@/shared/ui/line-tabs';
import { PageContainer, PageHeader, SectionCard } from '@/shared/ui/page-header';
import { EmptyState, ErrorState, ListSkeleton } from '@/shared/ui/states';
import { Switch } from '@/shared/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';

const NewDeployDialog = dynamic(() => import('@/features/deploy/new-deploy-dialog').then((m) => m.NewDeployDialog), { ssr: false });

export function DeployView() {
  const [s, set] = useSearchState({ tab: 'agents', new: '', agent: '' });
  const eps = useEndpoints();
  const wfs = useWorkflows({ limit: 100 });
  const update = useUpdateEndpoint();
  const { can } = useCurrentWorkspace();
  const [openManual, setOpenManual] = useState(false);
  const dialogOpen = openManual || (!!s.new && can('deploy'));
  const list = eps.data ?? [];

  const toggle = (id: string, slug: string, v: boolean) =>
    update.mutate({ id, is_active: v }, { onSuccess: () => toast.success(v ? `/${slug}를 켰습니다.` : `/${slug}를 껐습니다. 호출하면 404가 납니다.`), onError: (e) => toast.error(e.message) });

  return (
    <PageContainer>
      <PageHeader
        title="배포 · API"
        description="에이전트와 워크플로를 API · 채팅 위젯 · 버튼 · 슬래시 명령으로 실행할 수 있게 합니다."
        actions={
          <Guarded allowed={can('deploy')} reason={copy.common.viewerReason}>
            <Button onClick={() => setOpenManual(true)} data-testid="new-deploy">
              <Plus aria-hidden /> 새 배포
            </Button>
          </Guarded>
        }
      />
      <LineTabs
        label="배포 대상"
        value={s.tab}
        onChange={(v) => set({ tab: v })}
        items={[
          { value: 'agents', label: `에이전트 ${list.length}` },
          { value: 'workflows', label: `워크플로 ${wfs.items.length}` },
        ]}
      />
      {s.tab === 'agents' ? (
        <SectionCard title="엔드포인트" bodyClassName="p-0 pt-3">
          {eps.isPending ? (
            <div className="p-5"><ListSkeleton rows={3} /></div>
          ) : eps.isError ? (
            <div className="p-5"><ErrorState error={eps.error} onRetry={() => void eps.refetch()} /></div>
          ) : list.length === 0 ? (
            <div className="p-5"><EmptyState title="아직 배포한 에이전트가 없어요" description="배포하면 외부에서 API로 부를 수 있습니다." /></div>
          ) : (
            <Table>
              <TableHeader className="bg-surface">
                <TableRow>
                  <TableHead>슬러그</TableHead>
                  <TableHead>에이전트</TableHead>
                  <TableHead>모드</TableHead>
                  <TableHead>버전</TableHead>
                  <TableHead className="text-right">호출(7일)</TableHead>
                  <TableHead className="text-right">분당 한도</TableHead>
                  <TableHead>수정</TableHead>
                  <TableHead>상태</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>
                      <Link href={`/deploy/${e.id}`} className="font-mono text-sm font-semibold hover:underline">
                        /{e.slug}
                      </Link>
                    </TableCell>
                    <TableCell>{e.agentName}</TableCell>
                    <TableCell>{e.mode === 'sync' ? '동기' : '비동기'}</TableCell>
                    <TableCell>v{e.version}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(e.callCount7d)}</TableCell>
                    <TableCell className="text-right tabular-nums">{e.rateLimitRpm}</TableCell>
                    <TableCell className="text-muted">{relativeTime(e.updatedAt)}</TableCell>
                    <TableCell>
                      <span className="flex items-center gap-2">
                        <Switch checked={e.isActive} onCheckedChange={(v) => toggle(e.id, e.slug, v)} disabled={!can('deploy')} aria-label={`/${e.slug} 켜기`} />
                        <Badge variant={e.isActive ? 'green' : 'gray'}>{e.isActive ? '켜짐' : '꺼짐'}</Badge>
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </SectionCard>
      ) : (
        <SectionCard title="워크플로 배포" bodyClassName="p-0 pt-3">
          <p className="bg-primary-soft text-primary mx-5 rounded-md px-3 py-2 text-sm">워크플로는 연결된 에이전트의 엔드포인트로 배포됩니다(엔드포인트는 에이전트 단위).</p>
          {wfs.isPending ? (
            <div className="p-5"><ListSkeleton rows={3} /></div>
          ) : wfs.isError ? (
            <div className="p-5"><ErrorState error={wfs.error} onRetry={() => void wfs.refetch()} /></div>
          ) : (
            <Table className="mt-3">
              <TableHeader className="bg-surface">
                <TableRow>
                  <TableHead>워크플로</TableHead>
                  <TableHead>연결된 에이전트</TableHead>
                  <TableHead>엔드포인트</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {wfs.items.map((w) => {
                  const mine = list.filter((e) => w.agents.some((a) => a.id === e.agentId));
                  return (
                    <TableRow key={w.id}>
                      <TableCell>
                        <Link href={`/workflows/${w.id}/edit`} className="font-semibold hover:underline">{w.name}</Link>
                      </TableCell>
                      <TableCell className="text-muted">{w.agents.map((a) => a.name).join(', ') || '없음 — 에이전트에 연결해야 배포할 수 있어요'}</TableCell>
                      <TableCell>
                        {mine.length ? (
                          mine.map((e) => (
                            <Link key={e.id} href={`/deploy/${e.id}`} className="mr-2 font-mono text-xs hover:underline">/{e.slug}</Link>
                          ))
                        ) : w.agents[0] && can('deploy') ? (
                          <Button size="xs" variant="outline" onClick={() => set({ new: '1', agent: w.agents[0]!.id })}>배포하기</Button>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </SectionCard>
      )}
      <SectionCard>
        <ApiKeysCard />
      </SectionCard>
      <NewDeployDialog
        open={dialogOpen}
        initialAgentId={s.agent || null}
        onOpenChange={(o) => {
          setOpenManual(o);
          if (!o) set({ new: '', agent: '' });
        }}
      />
    </PageContainer>
  );
}
