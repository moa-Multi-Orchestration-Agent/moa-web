'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { Skeleton } from '@/shared/ui/skeleton';

// React Flow는 편집기 라우트에서만 불러온다(design.md 3.4.5)
const WorkflowEditor = dynamic(() => import('@/features/editor/editor'), {
  ssr: false,
  loading: () => <Skeleton className="m-4 h-[calc(100%-2rem)]" />,
});

export function EditorLoader({ id }: { id: string }) {
  return (
    <Suspense>
      <WorkflowEditor workflowId={id} />
    </Suspense>
  );
}
