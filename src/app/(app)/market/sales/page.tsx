import type { Metadata } from 'next';
import { Suspense } from 'react';
import { copy } from '@/shared/lib/copy';
import { SalesView } from '../_components/sales-view';

export const metadata: Metadata = { title: copy.pages.marketSales };

export default function SalesPage() {
  return (
    <Suspense>
      <SalesView />
    </Suspense>
  );
}
