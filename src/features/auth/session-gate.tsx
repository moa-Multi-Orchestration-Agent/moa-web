'use client';

import { useEffect } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMe } from '@/entities/user';
import { useCurrentWorkspaceStore, useWorkspaces } from '@/entities/workspace';
import { isApiError } from '@/shared/lib/api-client';
import { copy } from '@/shared/lib/copy';
import { Skeleton } from '@/shared/ui/skeleton';
import { ErrorState } from '@/shared/ui/states';
import { loginHref } from './safe-redirect';

/**
 * (app) 라우트 보호: 로그인 안 되어 있으면 /login?redirect=… 로 보낸다.
 * 로그인되어 있으면 워크스페이스 목록을 불러와 현재 워크스페이스를 정한다.
 */
export function SessionGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() ?? '/home';
  const search = useSearchParams()?.toString();
  const me = useMe();
  const ws = useWorkspaces({ enabled: me.isSuccess });
  const currentId = useCurrentWorkspaceStore((s) => s.id);
  const setId = useCurrentWorkspaceStore((s) => s.setId);

  const unauthorized = me.isError && isApiError(me.error) && me.error.status === 401;

  useEffect(() => {
    if (unauthorized) router.replace(loginHref(pathname + (search ? `?${search}` : '')));
  }, [unauthorized, router, pathname, search]);

  useEffect(() => {
    if (!ws.data?.length) return;
    if (!currentId || !ws.data.some((w) => w.id === currentId)) setId(ws.data[0]!.id);
  }, [ws.data, currentId, setId]);

  if (me.isError && !unauthorized) {
    return (
      <div className="flex h-dvh items-center justify-center p-6">
        <ErrorState error={me.error} onRetry={() => void me.refetch()} />
      </div>
    );
  }
  if (ws.isError) {
    return (
      <div className="flex h-dvh items-center justify-center p-6">
        <ErrorState error={ws.error} onRetry={() => void ws.refetch()} />
      </div>
    );
  }
  if (!me.data || !currentId) {
    return (
      <div className="flex h-dvh" aria-busy="true" aria-label={unauthorized ? copy.auth.sessionExpired : copy.common.loading}>
        <div className="w-[232px] border-r p-4">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="mt-4 h-9 w-full" />
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="mt-3 h-7 w-full" />
          ))}
        </div>
        <div className="flex-1 p-8">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="mt-6 h-40 w-full" />
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
