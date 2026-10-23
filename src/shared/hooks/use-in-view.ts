'use client';

import { useEffect, useRef, useState } from 'react';

/** 요소가 화면에 들어오면 true (무한 스크롤 감시용) */
export function useInView<T extends Element>(options: IntersectionObserverInit = { rootMargin: '200px' }) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([entry]) => setInView(!!entry?.isIntersecting), options);
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return { ref, inView };
}
