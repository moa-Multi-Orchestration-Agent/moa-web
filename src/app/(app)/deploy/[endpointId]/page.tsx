import type { Metadata } from 'next';
import { Suspense } from 'react';
import { copy } from '@/shared/lib/copy';
import { EndpointView } from '../_components/endpoint-view';

export const metadata: Metadata = { title: copy.pages.deployDetail };

export default async function EndpointPage({ params }: { params: Promise<{ endpointId: string }> }) {
  const { endpointId } = await params;
  return (
    <Suspense>
      <EndpointView id={endpointId} />
    </Suspense>
  );
}
