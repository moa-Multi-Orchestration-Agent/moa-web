import type { Metadata } from 'next';
import { Suspense } from 'react';
import { copy } from '@/shared/lib/copy';
import { StudioView } from './_components/studio-view';

export const metadata: Metadata = { title: copy.pages.studio };

export default function StudioPage() {
  return (
    <Suspense>
      <StudioView />
    </Suspense>
  );
}
