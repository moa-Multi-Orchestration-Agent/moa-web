'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { MARKET_CATEGORIES, MARKET_SORTS, useProducts } from '@/entities/product';
import { useCurrentWorkspace } from '@/entities/workspace';
import { ProductCard } from '@/features/market/product-card';
import { useDebounced } from '@/shared/hooks/use-debounced';
import { useInView } from '@/shared/hooks/use-in-view';
import { useSearchState } from '@/shared/hooks/use-search-state';
import { copy } from '@/shared/lib/copy';
import { Button } from '@/shared/ui/button';
import { ChipGroup } from '@/shared/ui/chips';
import { Guarded } from '@/shared/ui/guarded';
import { Input } from '@/shared/ui/input';
import { PageContainer, PageHeader } from '@/shared/ui/page-header';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { CardGridSkeleton, EmptyState, ErrorState } from '@/shared/ui/states';

export function MarketView() {
  const [s, set] = useSearchState({ q: '', category: 'all', sort: 'popular', kind: 'all', license: 'all' });
  const [q, setQ] = useState(s.q);
  const dq = useDebounced(q, 300);
  useEffect(() => {
    if (dq !== s.q) set({ q: dq });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dq]);
  const { can } = useCurrentWorkspace();
  const p = useProducts({ q: s.q || undefined, category: s.category === 'all' ? undefined : s.category, sort: s.sort, kind: s.kind === 'all' ? undefined : (s.kind as 'agent' | 'workflow'), license: s.license === 'all' ? undefined : s.license });
  const { ref, inView } = useInView<HTMLDivElement>();
  useEffect(() => {
    if (inView && p.hasNextPage && !p.isFetchingNextPage) void p.fetchNextPage();
  }, [inView, p]);

  const sel = (v: string, onChange: (v: string) => void, opts: [string, string][], label: string) => (
    <Select value={v} onValueChange={onChange}>
      <SelectTrigger className="h-10 w-auto min-w-28" aria-label={label}><SelectValue /></SelectTrigger>
      <SelectContent>{opts.map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
    </Select>
  );

  return (
    <PageContainer className="max-w-[1280px]">
      <PageHeader
        title="마켓"
        description="다른 사람이 만든 에이전트와 워크플로를 설치하거나, 내 것을 공유·판매합니다."
        actions={
          <>
            <Button variant="outline" asChild><Link href="/market/purchases">내 구매</Link></Button>
            <Guarded allowed={can('market')} reason={copy.common.adminOnly}>
              <Button asChild={can('market')}>{can('market') ? <Link href="/market/sell">+ 판매 등록</Link> : <span>+ 판매 등록</span>}</Button>
            </Guarded>
          </>
        }
      />
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[280px] flex-1">
          <Search className="text-muted pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="어떤 일을 대신할 에이전트나 워크플로를 찾나요?" aria-label="마켓 검색" className="h-10 pl-9" />
        </div>
        {sel(s.kind, (v) => set({ kind: v }), [['all', '종류: 전체'], ['agent', '에이전트'], ['workflow', '워크플로']], '종류')}
        {sel(s.license, (v) => set({ license: v }), [['all', '가격: 전체'], ['free', '무료'], ['clone', '복제 판매'], ['api_sub', 'API 구독']], '가격')}
        {sel(s.sort, (v) => set({ sort: v }), MARKET_SORTS.map((x) => [x.id, x.label]), '정렬')}
      </div>
      <ChipGroup label="카테고리" value={s.category} onChange={(v) => set({ category: v })} options={[{ value: 'all', label: '전체' }, ...MARKET_CATEGORIES.map((c) => ({ value: c.id as string, label: c.label }))]} />
      {p.isPending ? (
        <CardGridSkeleton count={8} className="xl:grid-cols-4" />
      ) : p.isError ? (
        <ErrorState error={p.error} onRetry={() => void p.refetch()} />
      ) : p.items.length === 0 ? (
        <EmptyState title="찾는 상품이 없어요" description="검색어나 카테고리를 바꿔 보세요." action={<Button variant="outline" onClick={() => { setQ(''); set({ q: '', category: 'all', kind: 'all', license: 'all' }); }}>필터 초기화</Button>} />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">{p.items.map((x) => <ProductCard key={x.id} p={x} />)}</div>
      )}
      <div ref={ref} className="h-1" aria-hidden />
    </PageContainer>
  );
}
