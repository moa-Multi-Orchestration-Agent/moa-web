'use client';

import { useMe } from '@/entities/user';
import { copy } from '@/shared/lib/copy';
import { PageContainer, PageHeader } from '@/shared/ui/page-header';
import { BuildCard } from './build-card';
import { RecentRuns } from './recent-runs';
import { RecentWork } from './recent-work';
import { PendingApprovals, RecommendedTemplates } from './side-cards';
import { StatsRow } from './stats-row';

export function HomeView() {
  const me = useMe();
  return (
    <PageContainer>
      <PageHeader title={copy.home.greeting(me.data?.displayName ?? '')} description={copy.home.subtitle} />
      <BuildCard />
      <StatsRow />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="min-w-0 space-y-5">
          <RecentWork />
          <RecentRuns />
        </div>
        <div className="space-y-5">
          <RecommendedTemplates />
          <PendingApprovals />
        </div>
      </div>
    </PageContainer>
  );
}
