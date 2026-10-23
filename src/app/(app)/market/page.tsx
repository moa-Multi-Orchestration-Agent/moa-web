import type { Metadata } from 'next';
import { copy } from '@/shared/lib/copy';
import { PageContainer, PageHeader } from '@/shared/ui/page-header';

export const metadata: Metadata = { title: copy.pages.market };

export default function Page() {
  return (
    <PageContainer>
      <PageHeader title={copy.pages.market} />
    </PageContainer>
  );
}
