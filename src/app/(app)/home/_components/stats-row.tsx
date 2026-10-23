'use client';

import { useBudgets } from '@/entities/budget';
import { useEndpoints } from '@/entities/endpoint';
import { useRuns } from '@/entities/run';
import { monthStartIso, useUsage } from '@/entities/usage';
import { copy } from '@/shared/lib/copy';
import { formatNumber, formatTokens, formatUsd, percent } from '@/shared/lib/format';
import { Gauge } from '@/shared/ui/gauge';
import { StatCard } from '@/shared/ui/stat-card';
import { ErrorState } from '@/shared/ui/states';

function todayIso() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/** 30일 전 0시(쿼리 키가 렌더마다 바뀌지 않게 날짜 단위로 자른다) */
function daysAgoIso(days: number) {
  const d = new Date(Date.now() - days * 86_400_000);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export function StatsRow() {
  const today = useRuns({ from: todayIso(), limit: 100 });
  const month = useRuns({ from: daysAgoIso(30), limit: 100 });
  const usage = useUsage({ from: monthStartIso(), group_by: 'model' });
  const budgets = useBudgets();
  const endpoints = useEndpoints();

  const failed = [today, month, usage, budgets, endpoints].find((q) => q.isError);
  if (failed) return <ErrorState compact error={failed.error} onRetry={() => [today, month, usage, budgets, endpoints].forEach((q) => void q.refetch())} />;

  const finished = month.items.filter((r) => r.status === 'succeeded' || r.status === 'failed');
  const rate = finished.length ? finished.filter((r) => r.status === 'succeeded').length / finished.length : null;
  const ws = budgets.data?.find((b) => b.scope_type === 'workspace');
  const cost = usage.data?.total.cost_usd ?? 0;
  const tokens = (usage.data?.total.tokens_in ?? 0) + (usage.data?.total.tokens_out ?? 0);
  const limit = ws?.monthly_limit_usd ?? null;
  const active = endpoints.data?.filter((e) => e.isActive).length ?? 0;

  return (
    <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
      <StatCard label={copy.home.stats.todayRuns} value={`${formatNumber(today.items.length)}회`} hint={copy.home.stats.todayRunsHint} loading={today.isPending} />
      <StatCard label={copy.home.stats.successRate} value={rate === null ? '—' : percent(rate)} hint={copy.home.stats.successRateHint} loading={month.isPending} />
      <StatCard
        label={copy.home.stats.monthCost}
        value={formatUsd(cost, 2)}
        hint={`${formatTokens(tokens)} 토큰 · ${limit ? copy.home.stats.budgetRatio(percent(cost / limit)) : copy.home.stats.noBudget}`}
        loading={usage.isPending || budgets.isPending}
      >
        {limit ? <Gauge className="mt-3" value={cost} max={limit} marker={ws?.alert_ratio} label="이번 달 예산 사용률" warnAt={ws?.alert_ratio ?? 0.8} /> : null}
      </StatCard>
      <StatCard label={copy.home.stats.deployed} value={`${active}개`} hint={copy.home.stats.deployedHint} loading={endpoints.isPending} />
    </div>
  );
}
