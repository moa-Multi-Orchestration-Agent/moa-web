'use client';

import { useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

/** URL searchParams를 상태처럼 읽고 쓴다(탭·필터·정렬). 기본값과 같으면 URL에서 뺀다. */
export function useSearchState<T extends Record<string, string>>(defaults: T) {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const state = Object.fromEntries(Object.entries(defaults).map(([k, d]) => [k, sp.get(k) ?? d])) as T;
  const set = useCallback(
    (patch: Partial<T>) => {
      const next = new URLSearchParams(sp.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined || v === null || v === '' || v === defaults[k]) next.delete(k);
        else next.set(k, String(v));
      }
      const q = next.toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sp, router, pathname],
  );
  return [state, set] as const;
}
