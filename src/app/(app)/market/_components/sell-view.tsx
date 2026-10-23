'use client';

import { useSearchParams } from 'next/navigation';
import { Lock } from 'lucide-react';
import { useCurrentWorkspace } from '@/entities/workspace';
import { SellWizard } from '@/features/market';
import { copy } from '@/shared/lib/copy';
import { PageContainer, PageHeader } from '@/shared/ui/page-header';
import { EmptyState } from '@/shared/ui/states';

export function SellView() {
  const sp = useSearchParams();
  const { can } = useCurrentWorkspace();
  return (
    <PageContainer className="max-w-[1280px]">
      <PageHeader title="마켓에 게시하기" description="에이전트나 워크플로를 무료로 공유하거나 판매할 수 있어요. 게시 전 보안 검사로 자격증명과 비밀값을 걸러 냅니다." />
      {can('market') ? <SellWizard initialAgentId={sp.get('agent')} /> : <EmptyState icon={<Lock className="size-8" />} title={copy.common.noPermission} description="마켓 게시는 관리자 이상만 할 수 있습니다(design.md 3.1.1)." />}
    </PageContainer>
  );
}
