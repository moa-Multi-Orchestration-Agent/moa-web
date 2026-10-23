import type { Metadata } from 'next';
import { Suspense } from 'react';
import { copy } from '@/shared/lib/copy';
import { AgentPage } from '../_components/agent-page';

export const metadata: Metadata = { title: copy.pages.agent };

export default async function AgentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense>
      <AgentPage agentId={id} />
    </Suspense>
  );
}
