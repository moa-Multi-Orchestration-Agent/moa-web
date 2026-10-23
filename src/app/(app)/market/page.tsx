import type { Metadata } from 'next';
import { Suspense } from 'react';
import { copy } from '@/shared/lib/copy';
import { MarketView } from './_components/market-view';

export const metadata: Metadata = { title: copy.pages.market };

export default function MarketPage() {
  return (
    <Suspense>
      <MarketView />
    </Suspense>
  );
}
