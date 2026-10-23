import type { Metadata } from 'next';
import { Suspense } from 'react';
import { copy } from '@/shared/lib/copy';
import { IntegrationsView } from './_components/integrations-view';

export const metadata: Metadata = { title: copy.pages.integrations };

export default function IntegrationsPage() {
  return (
    <Suspense>
      <IntegrationsView />
    </Suspense>
  );
}
