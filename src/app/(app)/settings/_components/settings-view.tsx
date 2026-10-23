'use client';

import dynamic from 'next/dynamic';
import { Lock } from 'lucide-react';
import { useCurrentWorkspace } from '@/entities/workspace';
import { useSearchState } from '@/shared/hooks/use-search-state';
import { LineTabs } from '@/shared/ui/line-tabs';
import { PageContainer, PageHeader, SectionCard } from '@/shared/ui/page-header';
import { Skeleton } from '@/shared/ui/skeleton';
import { TeamTab } from './team-tab';

// 기본 탭(팀·권한) 밖은 열 때만 불러온다
const loading = () => <Skeleton className="h-64 w-full" />;
const BudgetTab = dynamic(() => import('./budget-tab').then((m) => m.BudgetTab), { ssr: false, loading });
const GeneralTab = dynamic(() => import('./general-tab').then((m) => m.GeneralTab), { ssr: false, loading });
const BillingTab = dynamic(() => import('./general-tab').then((m) => m.BillingTab), { ssr: false, loading });
const ApiKeysCard = dynamic(() => import('@/features/deploy/api-keys-card').then((m) => m.ApiKeysCard), { ssr: false, loading });

const TABS = [
  { value: 'team', label: '팀 · 권한' },
  { value: 'budget', label: '예산 · 사용량' },
  { value: 'api-keys', label: 'API 키' },
  { value: 'billing', label: '결제 · 정산' },
  { value: 'general', label: '일반' },
];

export function SettingsView() {
  const [s, set] = useSearchState({ tab: 'team' });
  const { workspace, role } = useCurrentWorkspace();
  return (
    <PageContainer>
      <PageHeader title="설정" description="팀원과 권한, 에이전트 · 워크플로별 예산 한도, 결제와 정산을 관리합니다." />
      {role === 'viewer' ? (
        <p role="note" className="bg-surface-strong flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm">
          <Lock className="size-4" aria-hidden /> {workspace?.name}에서 뷰어 권한이라 보기만 할 수 있어요. 수정 버튼에 마우스를 올리면 이유가 보입니다.
        </p>
      ) : null}
      <LineTabs label="설정 탭" value={s.tab} onChange={(v) => set({ tab: v })} items={TABS} />
      {s.tab === 'budget' ? <BudgetTab /> : s.tab === 'api-keys' ? <SectionCard><ApiKeysCard /></SectionCard> : s.tab === 'billing' ? <BillingTab /> : s.tab === 'general' ? <GeneralTab /> : <TeamTab />}
    </PageContainer>
  );
}
