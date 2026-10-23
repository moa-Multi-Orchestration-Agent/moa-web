import type { Metadata } from 'next';
import { Suspense } from 'react';
import { copy } from '@/shared/lib/copy';
import { AgentPage } from '../_components/agent-page';

export const metadata: Metadata = { title: copy.pages.agentNew };

export default function AgentNewPage() {
  return (
    <Suspense>
      <AgentPage agentId={null} />
    </Suspense>
  );
}
