'use client';

import Link from 'next/link';
import { TRIGGER_LABEL, type Workflow } from '@/entities/workflow';
import { copy } from '@/shared/lib/copy';
import { relativeTime } from '@/shared/lib/format';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { MiniChain } from '@/shared/ui/mini-chain';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { ItemMenu } from './item-menu';

function statusOf(w: Workflow) {
  if (w.listed) return { label: '마켓 판매 중', variant: 'blue' as const };
  if (w.deployed) return { label: '배포됨', variant: 'green' as const };
  return { label: w.latestVersion ? `초안 v${w.latestVersion}` : '초안', variant: 'gray' as const };
}

function triggerLabel(w: Workflow) {
  return TRIGGER_LABEL[w.trigger] ?? w.trigger;
}

export function WorkflowTable({ items }: { items: Workflow[] }) {
  const c = copy.studio.columns;
  return (
    <div className="bg-card overflow-hidden rounded-lg border">
      <Table>
        <TableHeader className="bg-surface">
          <TableRow>
            <TableHead className="w-[32%]">{c.name}</TableHead>
            <TableHead>{c.trigger}</TableHead>
            <TableHead>{c.nodes}</TableHead>
            <TableHead>{c.agents}</TableHead>
            <TableHead>{c.status}</TableHead>
            <TableHead>{c.lastRun}</TableHead>
            <TableHead className="w-10">
              <span className="sr-only">메뉴</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((w) => {
            const s = statusOf(w);
            return (
              <TableRow key={w.id} className="h-[61px]">
                <TableCell>
                  <Link href={`/workflows/${w.id}/edit`} className="font-semibold hover:underline">
                    {w.name}
                  </Link>
                  <div className="mt-1.5">
                    <MiniChain types={w.mini ?? []} />
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="gray">{triggerLabel(w)}</Badge>
                </TableCell>
                <TableCell className="tabular-nums">{w.nodeCount}</TableCell>
                <TableCell>{w.agents.map((a) => a.name).join(', ') || '—'}</TableCell>
                <TableCell>
                  <Badge variant={s.variant}>{s.label}</Badge>
                </TableCell>
                <TableCell className="text-muted">{w.lastRunAt ? relativeTime(w.lastRunAt) : '—'}</TableCell>
                <TableCell>
                  <ItemMenu kind="workflow" id={w.id} name={w.name} href={`/workflows/${w.id}/edit`} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

export function WorkflowCard({ w }: { w: Workflow }) {
  const s = statusOf(w);
  return (
    <article className="bg-card flex flex-col rounded-lg border p-5" aria-label={w.name}>
      <header className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-bold">
            <Link href={`/workflows/${w.id}/edit`} className="hover:underline">
              {w.name}
            </Link>
          </h3>
          <p className="text-muted line-clamp-2 text-xs">{w.description}</p>
        </div>
        <ItemMenu kind="workflow" id={w.id} name={w.name} href={`/workflows/${w.id}/edit`} />
      </header>
      <MiniChain types={w.mini ?? []} className="mt-4" />
      <div className="mt-3 flex flex-wrap gap-1.5">
        <Badge variant="gray">{triggerLabel(w)}</Badge>
        <Badge variant={s.variant}>{s.label}</Badge>
        <Badge variant="gray">노드 {w.nodeCount}</Badge>
      </div>
      <p className="text-muted mt-3 text-xs">
        {w.agents.length ? `${w.agents.map((a) => a.name).join(', ')}에서 사용` : '연결된 에이전트 없음'} · {relativeTime(w.updatedAt)} 수정
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2 border-t pt-4">
        <Button variant="outline" asChild>
          <Link href={`/workflows/${w.id}/edit`}>{copy.studio.edit}</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href={`/workflows/${w.id}/edit?run=1`}>{copy.studio.test}</Link>
        </Button>
      </div>
    </article>
  );
}
