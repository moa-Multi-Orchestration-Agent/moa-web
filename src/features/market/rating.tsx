import { Star } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

export function Stars({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-0.5', className)} aria-label={`별점 ${value.toFixed(1)}점`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={cn('size-3.5', i <= Math.round(value) ? 'fill-warning text-warning' : 'text-border')} aria-hidden />
      ))}
    </span>
  );
}

export function RatingBars({ distribution, total }: { distribution: Record<string, number>; total: number }) {
  return (
    <ul className="space-y-1" aria-label="별점 분포">
      {[5, 4, 3, 2, 1].map((n) => {
        const c = distribution[String(n)] ?? 0;
        const pct = total ? Math.round((c / total) * 100) : 0;
        return (
          <li key={n} className="flex items-center gap-2 text-xs">
            <span className="w-6 tabular-nums">{n}점</span>
            <span className="bg-surface-strong h-2 flex-1 overflow-hidden rounded-full" aria-hidden>
              <span className="bg-warning block h-full rounded-full" style={{ width: `${pct}%` }} />
            </span>
            <span className="text-muted w-14 text-right tabular-nums">
              {c}건 · {pct}%
            </span>
          </li>
        );
      })}
    </ul>
  );
}
