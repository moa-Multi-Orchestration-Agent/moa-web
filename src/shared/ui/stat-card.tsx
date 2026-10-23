import { cn } from '@/shared/lib/utils';
import { Skeleton } from './skeleton';

export function StatCard({
  label,
  value,
  hint,
  loading,
  children,
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  loading?: boolean;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('bg-card rounded-lg border p-5', className)}>
      <p className="text-muted text-[13px]">{label}</p>
      {loading ? (
        <Skeleton className="mt-2 h-8 w-28" />
      ) : (
        <p className="mt-1 text-[28px] leading-9 font-bold tracking-tight">{value}</p>
      )}
      {hint ? <p className="text-muted mt-1 text-xs">{hint}</p> : null}
      {children}
    </div>
  );
}
