import type { Metadata } from 'next';
import { Suspense } from 'react';
import { copy } from '@/shared/lib/copy';
import { RunsView } from './_components/runs-view';

export const metadata: Metadata = { title: copy.pages.runs };

export default function RunsPage() {
  return (
    <Suspense>
      <RunsView />
    </Suspense>
  );
}
