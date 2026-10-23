'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useEndpoint } from '@/entities/endpoint';
import { useSearchState } from '@/shared/hooks/use-search-state';
import { isApiError } from '@/shared/lib/api-client';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { LineTabs } from '@/shared/ui/line-tabs';
import { PageContainer, PageHeader } from '@/shared/ui/page-header';
import { Skeleton } from '@/shared/ui/skeleton';
import { EmptyState, ErrorState } from '@/shared/ui/states';
import { EndpointOverview } from './endpoint-overview';

const tab = (name: 'ExamplesTab' | 'OpenApiTab' | 'PlaygroundTab' | 'WebhookTab') => dynamic(() => import('./endpoint-tabs').then((m) => m[name]), { ssr: false, loading: () => <Skeleton className="h-64" /> });
const ExamplesTab = tab('ExamplesTab');
const OpenApiTab = tab('OpenApiTab');
const PlaygroundTab = tab('PlaygroundTab');
const WebhookTab = tab('WebhookTab');

const TABS = [
  { value: 'overview', label: '개요' },
  { value: 'examples', label: '호출 예시' },
  { value: 'openapi', label: 'OpenAPI' },
  { value: 'playground', label: '플레이그라운드' },
  { value: 'webhook', label: '웹훅' },
];

export function EndpointView({ id }: { id: string }) {
  const [s, set] = useSearchState({ tab: 'overview' });
  const q = useEndpoint(id);
  if (q.isPending) return <PageContainer><Skeleton className="h-10 w-72" /><Skeleton className="h-96" /></PageContainer>;
  if (q.isError) {
    const nf = isApiError(q.error) && q.error.status === 404;
    return <PageContainer>{nf ? <EmptyState title="엔드포인트를 찾을 수 없어요" action={<Button asChild><Link href="/deploy">배포 목록으로</Link></Button>} /> : <ErrorState error={q.error} onRetry={() => void q.refetch()} />}</PageContainer>;
  }
  const ep = q.data!;
  return (
    <PageContainer>
      <Link href="/deploy" className="text-muted hover:text-foreground inline-flex items-center gap-1 text-sm">
        <ArrowLeft className="size-4" aria-hidden /> 배포 · API
      </Link>
      <PageHeader
        title={<span className="font-mono">/{ep.slug}</span>}
        description={
          <span className="flex items-center gap-2">
            {ep.agentName} · {ep.mode === 'sync' ? '동기' : '비동기'} · 워크플로 v{ep.version} <Badge variant={ep.isActive ? 'green' : 'gray'}>{ep.isActive ? '켜짐' : '꺼짐'}</Badge>
          </span>
        }
      />
      <LineTabs label="엔드포인트 탭" value={s.tab} onChange={(v) => set({ tab: v })} items={TABS} />
      {s.tab === 'examples' ? <ExamplesTab ep={ep} /> : s.tab === 'openapi' ? <OpenApiTab ep={ep} /> : s.tab === 'playground' ? <PlaygroundTab ep={ep} /> : s.tab === 'webhook' ? <WebhookTab ep={ep} /> : <EndpointOverview ep={ep} />}
    </PageContainer>
  );
}
