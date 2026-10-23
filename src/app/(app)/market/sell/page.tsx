import type { Metadata } from 'next';
import { Suspense } from 'react';
import { copy } from '@/shared/lib/copy';
import { SellView } from '../_components/sell-view';

export const metadata: Metadata = { title: copy.pages.marketSell };

export default function SellPage() {
  return (
    <Suspense>
      <SellView />
    </Suspense>
  );
}
