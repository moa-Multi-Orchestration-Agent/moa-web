import type { Metadata } from 'next';
import { Suspense } from 'react';
import { copy } from '@/shared/lib/copy';
import { DeployView } from './_components/deploy-view';

export const metadata: Metadata = { title: copy.pages.deploy };

export default function DeployPage() {
  return (
    <Suspense>
      <DeployView />
    </Suspense>
  );
}
