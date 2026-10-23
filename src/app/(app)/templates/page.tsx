import type { Metadata } from 'next';
import { Suspense } from 'react';
import { copy } from '@/shared/lib/copy';
import { TemplatesView } from './_components/templates-view';

export const metadata: Metadata = { title: copy.pages.templates };

export default function TemplatesPage() {
  return (
    <Suspense>
      <TemplatesView />
    </Suspense>
  );
}
