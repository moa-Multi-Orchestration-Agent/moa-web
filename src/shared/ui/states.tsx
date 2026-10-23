'use client';

import { AlertTriangle, Inbox, RotateCw } from 'lucide-react';
import { copy } from '@/shared/lib/copy';
import { isApiError } from '@/shared/lib/api-client';
import { cn } from '@/shared/lib/utils';
import { Button } from './button';
import { Skeleton } from './skeleton';

export function EmptyState({
  title = copy.common.emptyTitle,
  description,
  action,
  icon,
  className,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-6 py-10 text-center',
        className,
      )}
    >
      <div className="text-muted" aria-hidden>
        {icon ?? <Inbox className="size-8" />}
      </div>
      <p className="font-semibold">{title}</p>
      {description ? <p className="text-muted max-w-md text-sm">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

/** 오류 상태 + 재시도 버튼. Problem Details 코드와 요청 ID를 보여 준다. */
export function ErrorState({
  error,
  onRetry,
  title = copy.common.errorTitle,
  className,
  compact,
}: {
  error?: unknown;
  onRetry?: () => void;
  title?: string;
  className?: string;
  compact?: boolean;
}) {
  const detail = isApiError(error) ? error.detail : error instanceof Error ? error.message : copy.common.errorFallback;
  const code = isApiError(error) ? error.code : undefined;
  const requestId = isApiError(error) ? error.requestId : undefined;
  return (
    <div
      role="alert"
      className={cn(
        'border-danger/30 bg-danger-soft/40 flex flex-col items-center justify-center gap-2 rounded-lg border px-6 text-center',
        compact ? 'py-4' : 'py-10',
        className,
      )}
    >
      <AlertTriangle className="text-danger size-6" aria-hidden />
      <p className="font-semibold">{title}</p>
      <p className="text-muted max-w-md text-sm">{detail}</p>
      {code ? (
        <p className="text-muted font-mono text-xs">
          {code}
          {requestId ? ` · ${copy.common.requestId} ${requestId}` : null}
        </p>
      ) : null}
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry} className="mt-1">
          <RotateCw aria-hidden /> {copy.common.retry}
        </Button>
      ) : null}
    </div>
  );
}

export function ListSkeleton({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)} aria-busy="true" aria-label={copy.common.loading}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}

export function CardGridSkeleton({ count = 6, className }: { count?: number; className?: string }) {
  return (
    <div
      className={cn('grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3', className)}
      aria-busy="true"
      aria-label={copy.common.loading}
    >
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-48 w-full rounded-lg" />
      ))}
    </div>
  );
}

/** 로딩·오류·빈 상태를 한 번에 처리하는 도우미 */
export function QueryState<T>({
  query,
  loading,
  empty,
  isEmpty,
  children,
}: {
  query: { isPending: boolean; isError: boolean; error: unknown; data: T | undefined; refetch: () => unknown };
  loading?: React.ReactNode;
  empty?: React.ReactNode;
  isEmpty?: (data: T) => boolean;
  children: (data: T) => React.ReactNode;
}) {
  if (query.isPending) return <>{loading ?? <ListSkeleton />}</>;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const data = query.data as T;
  if (isEmpty?.(data) && empty) return <>{empty}</>;
  return <>{children(data)}</>;
}
