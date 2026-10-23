'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { copy } from '@/shared/lib/copy';
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';

/**
 * 저장하지 않은 변경이 있을 때 이탈 경고.
 * - 새로고침·탭 닫기: beforeunload
 * - 앱 안 링크 이동: 문서의 <a> 클릭을 가로채 확인 다이얼로그
 */
export function useLeaveGuard(dirty: boolean) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
      const a = (e.target as HTMLElement | null)?.closest('a');
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
      const href = a.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('http')) return;
      const url = new URL(href, window.location.href);
      if (url.pathname === window.location.pathname) return;
      e.preventDefault();
      e.stopPropagation();
      setPending(url.pathname + url.search);
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('click', onClick, true);
    };
  }, [dirty]);

  const dialog = (
    <ConfirmDialog
      open={!!pending}
      onOpenChange={(o) => !o && setPending(null)}
      title={copy.common.unsavedLeave}
      description="떠나면 지금까지 바꾼 내용이 사라집니다."
      confirmLabel="저장하지 않고 떠나기"
      onConfirm={() => {
        const to = pending!;
        setPending(null);
        router.push(to);
      }}
    />
  );
  return { dialog, confirmLeave: (to: string) => (dirty ? setPending(to) : router.push(to)) };
}
