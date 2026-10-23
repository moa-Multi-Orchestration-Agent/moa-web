'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { budgetFormSchema, useBudgets, useSetBudget, type BudgetRow } from '@/entities/budget';
import { useUsage } from '@/entities/usage';
import { useCurrentWorkspace } from '@/entities/workspace';
import { copy } from '@/shared/lib/copy';
import { formatNumber, formatUsd, percent } from '@/shared/lib/format';
import { BarChart } from '@/shared/ui/bar-chart';
import { Button } from '@/shared/ui/button';
import { Gauge } from '@/shared/ui/gauge';
import { Guarded } from '@/shared/ui/guarded';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { SectionCard } from '@/shared/ui/page-header';
import { Skeleton } from '@/shared/ui/skeleton';
import { ErrorState, ListSkeleton } from '@/shared/ui/states';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';

function since30() {
  const d = new Date(Date.now() - 29 * 86_400_000);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function BudgetForm({ b, disabled }: { b: BudgetRow; disabled: boolean }) {
  const set = useSetBudget();
  const [v, setV] = useState({ monthly: String(b.monthly_limit_usd ?? ''), perRun: String(b.per_run_limit_usd ?? ''), alert: String(Math.round(b.alert_ratio * 100)) });
  useEffect(() => setV({ monthly: String(b.monthly_limit_usd ?? ''), perRun: String(b.per_run_limit_usd ?? ''), alert: String(Math.round(b.alert_ratio * 100)) }), [b.monthly_limit_usd, b.per_run_limit_usd, b.alert_ratio]);
  const [err, setErr] = useState<string | null>(null);
  const save = () => {
    const r = budgetFormSchema.safeParse({ monthly_limit_usd: Number(v.monthly), per_run_limit_usd: Number(v.perRun), alert_ratio: Number(v.alert) / 100 });
    if (!r.success) return setErr(r.error.issues[0]!.message);
    setErr(null);
    set.mutate({ scope_type: b.scope_type, scope_id: b.scope_id, ...r.data }, { onSuccess: () => toast.success('예산을 저장했습니다.'), onError: (e) => toast.error(e.message) });
  };
  return (
    <form onSubmit={(e) => { e.preventDefault(); save(); }} className="grid items-end gap-3 sm:grid-cols-4">
      <div className="space-y-1.5"><Label htmlFor={`m-${b.id}`}>월 한도($)</Label><Input id={`m-${b.id}`} type="number" min={0} value={v.monthly} onChange={(e) => setV((x) => ({ ...x, monthly: e.target.value }))} disabled={disabled} /></div>
      <div className="space-y-1.5"><Label htmlFor={`r-${b.id}`}>실행당 한도($)</Label><Input id={`r-${b.id}`} type="number" min={0} step={0.1} value={v.perRun} onChange={(e) => setV((x) => ({ ...x, perRun: e.target.value }))} disabled={disabled} /></div>
      <div className="space-y-1.5"><Label htmlFor={`a-${b.id}`}>알림 비율(%)</Label><Input id={`a-${b.id}`} type="number" min={10} max={100} value={v.alert} onChange={(e) => setV((x) => ({ ...x, alert: e.target.value }))} disabled={disabled} /></div>
      <Guarded allowed={!disabled} reason={copy.common.adminOnly}><Button type="submit" variant="outline" disabled={set.isPending}>저장</Button></Guarded>
      {err ? <p role="alert" className="text-danger text-xs sm:col-span-4">{err}</p> : null}
    </form>
  );
}

export function BudgetTab() {
  const { can } = useCurrentWorkspace();
  const budgets = useBudgets();
  const from = since30();
  const byDay = useUsage({ from, group_by: 'day' });
  const byModel = useUsage({ from, group_by: 'model' });
  const byAgent = useUsage({ from, group_by: 'agent' });
  const ws = budgets.data?.find((b) => b.scope_type === 'workspace');
  const others = budgets.data?.filter((b) => b.scope_type !== 'workspace') ?? [];
  const disabled = !can('budget');

  const usageTable = (q: typeof byModel, label: string) => (
    <SectionCard title={label} bodyClassName="p-0 pt-3">
      {q.isPending ? <div className="p-5"><ListSkeleton rows={3} /></div> : q.isError ? <div className="p-5"><ErrorState compact error={q.error} onRetry={() => void q.refetch()} /></div> : (
        <Table>
          <TableHeader className="bg-surface"><TableRow><TableHead>{label.replace('별 사용량', '')}</TableHead><TableHead className="text-right">실행</TableHead><TableHead className="text-right">토큰</TableHead><TableHead className="text-right">비용</TableHead><TableHead className="text-right">비중</TableHead></TableRow></TableHeader>
          <TableBody>
            {q.data!.items.map((r) => (
              <TableRow key={r.key}>
                <TableCell>{r.label}</TableCell>
                <TableCell className="text-right tabular-nums">{formatNumber(r.runs)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatNumber(r.tokens_in + r.tokens_out)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatUsd(r.cost_usd, 2)}</TableCell>
                <TableCell className="text-right tabular-nums">{q.data!.total.cost_usd ? percent(r.cost_usd / q.data!.total.cost_usd) : '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </SectionCard>
  );

  return (
    <div className="space-y-5">
      {budgets.isError ? <ErrorState error={budgets.error} onRetry={() => void budgets.refetch()} /> : null}
      <SectionCard title="워크스페이스 예산">
        {!ws ? <Skeleton className="h-28" /> : (
          <div className="space-y-4">
            <div>
              <p className="flex justify-between text-sm"><span>이번 달 사용</span><span className="font-mono tabular-nums">{formatUsd(ws.spent_usd, 2)} / 한도 {formatUsd(ws.monthly_limit_usd ?? 0, 0)}</span></p>
              <Gauge className="mt-2" value={ws.spent_usd} max={ws.monthly_limit_usd ?? 0} marker={ws.alert_ratio} warnAt={ws.alert_ratio} label="워크스페이스 월 예산 사용률" />
              <p className="text-muted mt-1 text-xs">한도에 도달하면 실행을 멈추고(402 MOA-BUD-001) 관리자에게 알립니다. 세로선은 알림 비율입니다.</p>
            </div>
            <BudgetForm b={ws} disabled={disabled} />
          </div>
        )}
      </SectionCard>
      <SectionCard title="에이전트별 월 예산 한도">
        {budgets.isPending ? <ListSkeleton rows={3} /> : (
          <ul className="space-y-5">
            {others.map((b) => (
              <li key={b.id} className="space-y-2">
                <p className="flex justify-between text-sm font-semibold"><span>{b.scope_name}</span><span className="text-muted font-mono font-normal tabular-nums">{formatUsd(b.spent_usd, 2)} / 한도 {formatUsd(b.monthly_limit_usd ?? 0, 0)}</span></p>
                <Gauge value={b.spent_usd} max={b.monthly_limit_usd ?? 0} warnAt={b.alert_ratio} label={`${b.scope_name} 예산 사용률`} />
                <BudgetForm b={b} disabled={disabled} />
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
      <SectionCard title="최근 30일 비용">
        {byDay.isPending ? <Skeleton className="h-48" /> : byDay.isError ? <ErrorState compact error={byDay.error} onRetry={() => void byDay.refetch()} /> : (
          <>
            <p className="text-muted mb-2 text-sm">합계 <b className="text-foreground">{formatUsd(byDay.data!.total.cost_usd, 2)}</b> · 토큰 {formatNumber(byDay.data!.total.tokens_in + byDay.data!.total.tokens_out)}</p>
            <BarChart label="최근 30일 일별 비용(USD)" data={byDay.data!.items.map((d) => ({ label: d.key, value: d.cost_usd, hint: `실행 ${d.runs}회` }))} format={(v) => `$${v.toFixed(v < 1 ? 2 : 1)}`} />
          </>
        )}
      </SectionCard>
      <div className="grid gap-5 xl:grid-cols-2">
        {usageTable(byModel, '모델별 사용량')}
        {usageTable(byAgent, '에이전트별 사용량')}
      </div>
    </div>
  );
}
