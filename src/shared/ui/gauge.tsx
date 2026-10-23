import { cn } from '@/shared/lib/utils';

/** 사용량 게이지. 경고 지점 표시(예: 70%, 80%)와 넘었을 때 색 변화. 수치는 글자로도 보여 준다. */
export function Gauge({
  value,
  max,
  marker,
  label,
  className,
  warnAt = 0.8,
}: {
  value: number;
  max: number;
  marker?: number;
  label: string;
  className?: string;
  warnAt?: number;
}) {
  const ratio = max > 0 ? value / max : 0;
  const pct = Math.min(100, Math.round(ratio * 100));
  const tone = ratio >= 1 ? 'bg-danger' : ratio >= warnAt ? 'bg-warning' : 'bg-primary';
  return (
    <div className={cn('relative', className)}>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={`${pct}%`}
        className="bg-surface-strong h-2 overflow-hidden rounded-full"
      >
        <div className={cn('h-full rounded-full transition-[width]', tone)} style={{ width: `${pct}%` }} />
      </div>
      {marker !== undefined ? (
        <span aria-hidden className="bg-foreground absolute -top-1 h-4 w-0.5" style={{ left: `${Math.min(100, marker * 100)}%` }} title={`${Math.round(marker * 100)}% 지점`} />
      ) : null}
    </div>
  );
}
