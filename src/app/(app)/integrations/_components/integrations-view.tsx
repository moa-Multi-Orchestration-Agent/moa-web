'use client';

import { useKnowledgeBases } from '@/entities/credential';
import { useSearchState } from '@/shared/hooks/use-search-state';
import { formatDate } from '@/shared/lib/format';
import { Badge } from '@/shared/ui/badge';
import { LineTabs } from '@/shared/ui/line-tabs';
import { PageContainer, PageHeader, SectionCard } from '@/shared/ui/page-header';
import { EmptyState, ErrorState, ListSkeleton } from '@/shared/ui/states';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { CredentialsCard } from './credentials';
import { McpTab } from './mcp-tab';

function KbTab() {
  const q = useKnowledgeBases();
  return (
    <SectionCard title="지식베이스 (RAG)" bodyClassName="p-0 pt-3">
      {q.isPending ? <div className="p-5"><ListSkeleton rows={3} /></div> : q.isError ? <div className="p-5"><ErrorState error={q.error} onRetry={() => void q.refetch()} /></div> : !q.data!.length ? <div className="p-5"><EmptyState title="지식베이스가 없어요" /></div> : (
        <Table>
          <TableHeader className="bg-surface"><TableRow><TableHead>이름</TableHead><TableHead>문서</TableHead><TableHead>임베딩 모델</TableHead><TableHead>청크</TableHead><TableHead>만든 날</TableHead></TableRow></TableHeader>
          <TableBody>
            {q.data!.map((k) => (
              <TableRow key={k.id}>
                <TableCell className="font-medium">{k.name}</TableCell>
                <TableCell>{k.ready_count}/{k.doc_count} {k.ready_count < k.doc_count ? <Badge variant="orange">색인 중 {k.doc_count - k.ready_count}</Badge> : <Badge variant="green">준비됨</Badge>}</TableCell>
                <TableCell className="font-mono text-xs">{k.embed_model}</TableCell>
                <TableCell className="text-muted">{k.chunk_size} / 겹침 {k.chunk_overlap}</TableCell>
                <TableCell className="text-muted">{formatDate(k.created_at)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <p className="text-muted px-5 py-3 text-xs">문서 업로드(사전 서명 URL)는 백엔드 연동 후 붙입니다.</p>
    </SectionCard>
  );
}

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
