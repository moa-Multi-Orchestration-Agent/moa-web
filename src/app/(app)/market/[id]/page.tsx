import type { Metadata } from 'next';
import { Suspense } from 'react';
import { copy } from '@/shared/lib/copy';
import { ProductView } from '../_components/product-view';

export const metadata: Metadata = { title: copy.pages.marketDetail };

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense>
      <ProductView id={id} />
    </Suspense>
  );
}
