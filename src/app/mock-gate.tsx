'use client';

import { useEffect, useState } from 'react';

const MOCKING = process.env.NEXT_PUBLIC_API_MOCKING === 'enabled';

/**
 * NEXT_PUBLIC_API_MOCKING=enabled일 때만 MSW 워커를 켠다.
 * 워커가 준비되기 전에는 앱을 그리지 않아 첫 요청이 실제 서버로 새는 것을 막는다.
 */
export function MockGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(!MOCKING);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!MOCKING) return;
    let alive = true;
    import('@/mocks/browser')
      .then(({ startMockWorker }) => startMockWorker())
      .then(() => { if (alive) setReady(true); })
      .catch((e) => {
        console.error('[MSW] 시작 실패', e);
        if (alive) setError(true);
      });
    return () => {
      alive = false;
    };
  }, [attempt]);

  if (error) {
    return (
      <div role="alert" className="flex h-dvh flex-col items-center justify-center gap-3 text-sm">
        <p>목 API를 시작하지 못했습니다. 연결을 확인하고 다시 시도해 주세요.</p>
        <button className="underline" onClick={() => { setError(false); setAttempt((n) => n + 1); }}>다시 시도</button>
      </div>
    );
  }

  if (!ready) {
    return (
      <div role="status" aria-live="polite" className="text-muted flex h-dvh items-center justify-center text-sm">
        목 API를 준비하는 중…
      </div>
    );
  }
  return <>{children}</>;
}
