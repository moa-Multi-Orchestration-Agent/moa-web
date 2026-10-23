import type { Metadata } from 'next';
import { copy } from '@/shared/lib/copy';
import { PurchasesView } from '../_components/purchases-view';

export const metadata: Metadata = { title: copy.pages.marketPurchases };

export default function PurchasesPage() {
  return <PurchasesView />;
}
