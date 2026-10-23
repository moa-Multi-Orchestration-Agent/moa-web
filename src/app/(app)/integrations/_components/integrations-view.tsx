'use client';

import { useSearchState } from '@/shared/hooks/use-search-state';
import { LineTabs } from '@/shared/ui/line-tabs';
import { PageContainer, PageHeader } from '@/shared/ui/page-header';
import { CredentialsCard } from './credentials';
import { KbTab } from './kb-tab';
import { McpTab } from './mcp-tab';

export function IntegrationsView() {
  const [s, set] = useSearchState({ tab: 'mcp' });
  return (
    <PageContainer className="max-w-[1280px]">
      <PageHeader title="연동" description="MCP 서버를 연결하면 도구가 스킬과 노드로 바로 추가됩니다. 자격증명 · 지식베이스 · 모델 키도 여기서 관리합니다." />
      <LineTabs label="연동 탭" value={s.tab} onChange={(v) => set({ tab: v })} items={[{ value: 'mcp', label: 'MCP 서버' }, { value: 'credentials', label: '자격증명' }, { value: 'kb', label: '지식베이스 (RAG)' }, { value: 'model-keys', label: '모델 키' }]} />
      {s.tab === 'credentials' ? <CredentialsCard /> : s.tab === 'kb' ? <KbTab /> : s.tab === 'model-keys' ? <CredentialsCard modelKeysOnly /> : (
        <div className="space-y-6">
          <McpTab />
          <CredentialsCard />
        </div>
      )}
    </PageContainer>
  );
}
