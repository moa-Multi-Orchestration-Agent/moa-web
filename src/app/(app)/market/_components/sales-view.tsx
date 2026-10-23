'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useMyProducts, useSalesStats } from '@/entities/product';
import { useCurrentWorkspace } from '@/entities/workspace';
import { Stars } from '@/features/market';
import { useSearchState } from '@/shared/hooks/use-search-state';
import { copy } from '@/shared/lib/copy';
import { formatKrw, formatNumber, relativeTime } from '@/shared/lib/format';
import { BarChart } from '@/shared/ui/bar-chart';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { ChipGroup } from '@/shared/ui/chips';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { Guarded } from '@/shared/ui/guarded';
import { PageContainer, PageHeader, SectionCard } from '@/shared/ui/page-header';
import { Skeleton } from '@/shared/ui/skeleton';
import { StatCard } from '@/shared/ui/stat-card';
import { EmptyState, ErrorState, ListSkeleton } from '@/shared/ui/states';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';

const STATUS: Record<string, { t: string; v: 'green' | 'blue' | 'orange' | 'gray' }> = { published: { t: '판매 중', v: 'green' }, in_review: { t: '검수 중', v: 'blue' }, suspended: { t: '반려', v: 'orange' }, draft: { t: '초안', v: 'gray' } };

export function SalesView() {
  const [s, set] = useSearchState({ days: '30' });
  const days = Number(s.days);
  const stats = useSalesStats(days);
  const mine = useMyProducts();
  const { can } = useCurrentWorkspace();
  const [reason, setReason] = useState<string | null>(null);
  const st = stats.data;

  return (
    <PageContainer>
      <PageHeader
        title="내 판매"
        description="마켓에 게시한 에이전트와 워크플로의 판매, 설치, 리뷰, 정산을 관리합니다."
        actions={
          <>
            <Button variant="outline" onClick={() => toast.info('정산 계좌는 설정 > 결제 · 정산에서 바꿉니다.')}>정산 계좌 설정</Button>
            <Guarded allowed={can('market')} reason={copy.common.adminOnly}>
              <Button asChild={can('market')}>{can('market') ? <Link href="/market/sell">+ 새로 게시</Link> : <span>+ 새로 게시</span>}</Button>
            </Guarded>
          </>
        }
      />
      {stats.isError ? <ErrorState error={stats.error} onRetry={() => void stats.refetch()} /> : (
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <StatCard label="이번 달 매출" value={st ? formatKrw(st.month_revenue_krw) : ''} loading={!st} />
          <StatCard label="신규 설치" value={st ? formatNumber(st.new_installs) : ''} loading={!st} />
          <StatCard label="평균 평점" value={st ? <span className="flex items-center gap-2">★ {st.rating_avg.toFixed(1)}</span> : ''} loading={!st} />
          <StatCard label="다음 정산 예정" value={st ? formatKrw(st.next_payout_krw) : ''} hint="수수료 20% 제외 · 매월 10일" loading={!st} />
        </div>
      )}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <SectionCard title="매출 · 설치 추이" actions={<ChipGroup label="기간" value={s.days} onChange={(v) => set({ days: v })} options={[{ value: '7', label: '7일' }, { value: '30', label: '30일' }, { value: '90', label: '90일' }]} />}>
          {!st ? <Skeleton className="h-48" /> : <BarChart label={`최근 ${days}일 일별 매출`} data={st.series.map((d) => ({ label: d.date, value: d.revenue_krw, hint: `설치 ${d.installs}건` }))} format={(v) => (v >= 10000 ? `₩${Math.round(v / 1000)}k` : `₩${v.toLocaleString('ko-KR')}`)} />}
        </SectionCard>
        <SectionCard title="최근 리뷰">
          {!st ? <ListSkeleton rows={3} /> : !st.recent_reviews.length ? <EmptyState title="리뷰가 아직 없어요" /> : (
            <ul className="divide-y">
              {st.recent_reviews.map((r) => (
                <li key={r.id} className="py-3 text-sm">
                  <p className="flex items-center gap-1.5 font-semibold">{r.author_name} <Stars value={r.rating} /></p>
                  <p className="text-muted">{r.body}</p>
                  <button type="button" className="text-primary mt-1 text-xs font-semibold" onClick={() => toast.info('답글 기능은 다음 단계에서 붙입니다.')}>답글 달기</button>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
      <SectionCard title="등록한 상품" bodyClassName="p-0 pt-3">
        {mine.isPending ? <div className="p-5"><ListSkeleton rows={3} /></div> : mine.isError ? <div className="p-5"><ErrorState error={mine.error} onRetry={() => void mine.refetch()} /></div> : !mine.data!.length ? (
          <div className="p-5"><EmptyState title="아직 등록한 상품이 없어요" action={<Button asChild><Link href="/market/sell">첫 상품 게시</Link></Button>} /></div>
        ) : (
          <Table>
            <TableHeader className="bg-surface"><TableRow><TableHead>상품</TableHead><TableHead>상태</TableHead><TableHead>라이선스</TableHead><TableHead className="text-right">설치</TableHead><TableHead className="text-right">매출</TableHead><TableHead>평점</TableHead><TableHead>수정</TableHead><TableHead className="w-32"><span className="sr-only">동작</span></TableHead></TableRow></TableHeader>
            <TableBody>
              {mine.data!.map((p) => (
                <TableRow key={p.id}>
                  <TableCell><span className="flex items-center gap-2"><Badge variant={p.kind === 'agent' ? 'blue' : 'gray'}>{p.kind === 'agent' ? '에이전트' : '워크플로'}</Badge><Link href={`/market/${p.id}`} className="hover:underline">{p.title}</Link></span></TableCell>
                  <TableCell><Badge variant={STATUS[p.status]!.v}>{STATUS[p.status]!.t}</Badge></TableCell>
                  <TableCell>{p.priceCloneKrw === 0 ? '무료 공유' : [p.licenseTypes.includes('clone') ? '복제' : null, p.licenseTypes.includes('api_sub') ? 'API 구독' : null].filter(Boolean).join(' · ')}</TableCell>
                  <TableCell className="text-right tabular-nums">{p.status === 'published' ? formatNumber(p.installCount) : '—'}</TableCell>
                  <TableCell className="text-right tabular-nums">{p.status === 'published' ? formatKrw(p.revenueKrw) : '—'}</TableCell>
                  <TableCell>{p.status === 'published' ? `★ ${p.ratingAvg.toFixed(1)}` : '—'}</TableCell>
                  <TableCell className="text-muted">{relativeTime(p.updatedAt)}</TableCell>
                  <TableCell>
                    {p.status === 'suspended' ? <Button size="sm" variant="warn" onClick={() => setReason(p.rejectReason ?? '사유 없음')}>사유 보기</Button> : p.status === 'published' ? <Button size="sm" variant="outline" asChild><Link href={p.agentId ? `/market/sell?agent=${p.agentId}` : '/market/sell'}>새 버전 게시</Link></Button> : <Button size="sm" variant="outline" disabled>검수 대기</Button>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionCard>
      <Dialog open={!!reason} onOpenChange={(o) => !o && setReason(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>반려 사유</DialogTitle><DialogDescription>{reason}</DialogDescription></DialogHeader>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
