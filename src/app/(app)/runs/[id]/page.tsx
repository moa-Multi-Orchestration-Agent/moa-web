import type { Metadata } from 'next';
import { copy } from '@/shared/lib/copy';
import { RunDetailView } from '../_components/run-detail-view';

export const metadata: Metadata = { title: copy.pages.run };

export default async function RunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RunDetailView id={id} />;
}
