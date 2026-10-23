import type { Metadata } from 'next';
import { Suspense } from 'react';
import { copy } from '@/shared/lib/copy';
import { NewView } from './_components/new-view';

export const metadata: Metadata = { title: copy.pages.studioNew };

export default function StudioNewPage() {
  return (
    <Suspense>
      <NewView />
    </Suspense>
  );
}
