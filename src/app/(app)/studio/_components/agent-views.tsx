'use client';

import Link from 'next/link';
import { modelLabel, type Agent } from '@/entities/agent';
import { useCurrentWorkspace } from '@/entities/workspace';
import { copy } from '@/shared/lib/copy';
import { relativeTime } from '@/shared/lib/format';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Guarded } from '@/shared/ui/guarded';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { ItemMenu } from './item-menu';

function subtitle(a: Agent) {
  if (a.purchased) return `마켓 구매 · ${relativeTime(a.createdAt)}`;
  if (a.lastRunAt && a.lastRunAt > a.updatedAt) return `${relativeTime(a.lastRunAt)} 실행`;
  return `${relativeTime(a.updatedAt)} 수정`;
}

export function agentBadges(a: Agent) {
  const out: { label: string; variant: 'gray' | 'green' | 'blue' | 'orange' }[] = [];
  if (a.purchased) out.push({ label: '구매함', variant: 'orange' });
  if (a.apiOnly) out.push({ label: 'API 전용', variant: 'gray' });
  if (a.endpointCount > 0) out.push({ label: '배포됨', variant: 'green' }, { label: 'API', variant: 'gray' });
  if (a.listed) out.push({ label: '마켓 판매 중', variant: 'blue' });
  for (const s of a.endpointSlugs.slice(0, 1)) out.push({ label: `/${s}`, variant: 'gray' });
  if (!a.purchased && a.endpointCount === 0) out.push({ label: a.latestVersion ? `초안 v${a.latestVersion}` : '초안', variant: 'gray' });
  return out;
}

function Actions({ a }: { a: Agent }) {
  const { can } = useCurrentWorkspace();
  const deployHref = a.endpointCount > 0 ? `/deploy?agent=${a.id}` : `/deploy?new=1&agent=${a.id}`;
  return (
    <div className="grid grid-cols-3 gap-2">
      <Button variant="outline" asChild>
        <Link href={`/agents/${a.id}`}>{copy.studio.edit}</Link>
      </Button>
      <Button variant="outline" asChild>
        <Link href={`/agents/${a.id}?tab=test`}>{copy.studio.test}</Link>
      </Button>
      <Guarded allowed={can('deploy') && !a.apiOnly} reason={a.apiOnly ? 'API 전용 라이선스는 다시 배포할 수 없습니다.' : copy.common.viewerReason}>
        <Button variant="outline" asChild={can('deploy') && !a.apiOnly} data-testid="agent-deploy">
          {can('deploy') && !a.apiOnly ? <Link href={deployHref}>{copy.studio.deploy}</Link> : <span>{copy.studio.deploy}</span>}
        </Button>
      </Guarded>
    </div>
  );
}

export function AgentCard({ a }: { a: Agent }) {
  const hidden = a.apiOnly;
  return (
    <article className="bg-card flex flex-col rounded-lg border p-5" aria-label={a.name}>
      <header className="flex items-start gap-3">
        <span aria-hidden className="bg-surface flex size-10 shrink-0 items-center justify-center rounded-md border text-xl">
          {a.icon ?? '🤖'}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-bold">
            <Link href={`/agents/${a.id}`} className="hover:underline">
              {a.name}
            </Link>
          </h3>
          <p className="text-muted text-xs">{subtitle(a)}</p>
        </div>
        <ItemMenu kind="agent" id={a.id} name={a.name} href={`/agents/${a.id}`} locked={a.apiOnly} />
      </header>
      <dl className="bg-surface mt-4 grid grid-cols-[64px_1fr] gap-x-3 gap-y-1.5 rounded-md p-3 text-sm">
        <dt className="text-muted text-xs leading-5">{copy.studio.model}</dt>
        <dd className="font-semibold">{hidden ? copy.studio.sellerEnv : modelLabel(a.model)}</dd>
        <dt className="text-muted text-xs leading-5">{copy.studio.skills}</dt>
        <dd className="line-clamp-2">{hidden ? copy.studio.hidden : a.skillNames.join(', ') || '—'}</dd>
        <dt className="text-muted text-xs leading-5">{copy.studio.workflows}</dt>
        <dd className="truncate">{hidden ? copy.studio.hidden : a.workflowNames.length ? `${a.workflowNames[0]}${a.workflowNames.length > 1 ? ` 외 ${a.workflowNames.length - 1}` : ''}` : '—'}</dd>
      </dl>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {agentBadges(a).map((b) => (
          <Badge key={b.label} variant={b.variant}>
            {b.label}
          </Badge>
        ))}
      </div>
      <div className="mt-auto border-t pt-4" style={{ marginTop: 16 }}>
        <Actions a={a} />
      </div>
    </article>
  );
}

export function AgentTable({ items }: { items: Agent[] }) {
  return (
    <div className="bg-card overflow-hidden rounded-lg border">
      <Table>
        <TableHeader className="bg-surface">
          <TableRow>
            <TableHead>에이전트</TableHead>
            <TableHead>모델</TableHead>
            <TableHead>스킬</TableHead>
            <TableHead>상태</TableHead>
            <TableHead>실행 수</TableHead>
            <TableHead>수정</TableHead>
            <TableHead className="w-10">
              <span className="sr-only">메뉴</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((a) => (
            <TableRow key={a.id}>
              <TableCell>
                <Link href={`/agents/${a.id}`} className="flex items-center gap-2 font-semibold hover:underline">
                  <span aria-hidden>{a.icon ?? '🤖'}</span>
                  {a.name}
                </Link>
              </TableCell>
              <TableCell>{a.apiOnly ? copy.studio.sellerEnv : modelLabel(a.model)}</TableCell>
              <TableCell>{a.apiOnly ? copy.studio.hidden : `${a.skillCount}개`}</TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {agentBadges(a)
                    .slice(0, 2)
                    .map((b) => (
                      <Badge key={b.label} variant={b.variant}>
                        {b.label}
                      </Badge>
                    ))}
                </div>
              </TableCell>
              <TableCell className="tabular-nums">{a.runCount}</TableCell>
              <TableCell className="text-muted">{relativeTime(a.updatedAt)}</TableCell>
              <TableCell>
                <ItemMenu kind="agent" id={a.id} name={a.name} href={`/agents/${a.id}`} locked={a.apiOnly} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
