import type { Metadata } from 'next';
import { copy } from '@/shared/lib/copy';
import { PageContainer, PageHeader } from '@/shared/ui/page-header';

export const metadata: Metadata = { title: copy.pages.login };

export default function Page() {
  return (
    <PageContainer>
      <PageHeader title={copy.pages.login} />
    </PageContainer>
  );
}
