'use client';

import { useEffect, useState } from 'react';

const MOCKING = process.env.NEXT_PUBLIC_API_MOCKING === 'enabled';

/**
 * NEXT_PUBLIC_API_MOCKING=enabled일 때만 MSW 워커를 켠다.
 * 워커가 준비되기 전에는 앱을 그리지 않아 첫 요청이 실제 서버로 새는 것을 막는다.
 */
export function MockGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(!MOCKING);

  useEffect(() => {
    if (!MOCKING) return;
    let alive = true;
    import('@/mocks/browser')
      .then(({ startMockWorker }) => startMockWorker())
      .catch((e) => console.error('[MSW] 시작 실패', e))
      .finally(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, []);

  if (!ready) {
    return (
      <div role="status" aria-live="polite" className="text-muted flex h-dvh items-center justify-center text-sm">
        목 API를 준비하는 중…
      </div>
    );
  }
  return <>{children}</>;
}
