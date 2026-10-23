'use client';

import { ROLE_LABEL, type BlockRole, type ContextBlockRow } from '@/entities/context';
import { cn } from '@/shared/lib/utils';

export const ROLE_STYLE: Record<BlockRole, { bar: string; badge: string }> = {
  system: { bar: 'bg-foreground', badge: 'bg-foreground text-background' },
  memory: { bar: 'bg-primary', badge: 'bg-primary text-primary-foreground' },
  knowledge: { bar: 'bg-[#C2417A]', badge: 'bg-[#C2417A] text-white' },
  tool: { bar: 'bg-primary/50', badge: 'bg-primary/50 text-white' },
  user: { bar: 'bg-muted', badge: 'bg-muted text-white' },
  history: { bar: 'bg-muted/40', badge: 'bg-surface-strong text-foreground' },
  summary: { bar: 'bg-warning', badge: 'bg-warning text-white' },
};

/** 역할별로 쌓은 토큰 막대 + 임계치 세로선 */
export function TokenBar({ blocks, budget, threshold }: { blocks: ContextBlockRow[]; budget: number; threshold: number }) {
  const enabled = blocks.filter((b) => b.enabled);
  const used = enabled.reduce((s, b) => s + b.token_count, 0);
  const byRole = new Map<BlockRole, number>();
  for (const b of enabled) byRole.set(b.role, (byRole.get(b.role) ?? 0) + b.token_count);
  const pct = budget ? Math.round((used / budget) * 100) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-semibold">토큰 사용량</span>
        <span className="font-mono text-sm tabular-nums" data-testid="context-usage">
          {used.toLocaleString('ko-KR')} / {budget.toLocaleString('ko-KR')} ({pct}%)
        </span>
      </div>
      <div
        className="bg-surface-strong relative mt-2 flex h-5 overflow-hidden rounded"
        role="meter"
        aria-label="컨텍스트 토큰 사용량"
        aria-valuemin={0}
        aria-valuemax={budget}
        aria-valuenow={used}
        aria-valuetext={`${pct}%, 임계치 ${Math.round(threshold * 100)}%`}
      >
        {[...byRole.entries()].map(([role, n]) => (
          <div key={role} className={cn('h-full border-r border-white/60', ROLE_STYLE[role].bar)} style={{ width: `${(n / budget) * 100}%` }} title={`${ROLE_LABEL[role]} ${n} 토큰`} />
        ))}
        <span className="bg-foreground absolute top-0 h-full w-0.5" style={{ left: `${threshold * 100}%` }} aria-hidden />
      </div>
      <ul className="text-muted mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
        {(['system', 'memory', 'tool', 'user', 'history', 'summary'] as BlockRole[]).map((r) => (
          <li key={r} className="flex items-center gap-1">
            <span className={cn('size-2.5 rounded-sm', ROLE_STYLE[r].bar)} aria-hidden />
            {ROLE_LABEL[r]}
          </li>
        ))}
        <li>| 세로선 = 임계치 {Math.round(threshold * 100)}%</li>
      </ul>
    </div>
  );
}
