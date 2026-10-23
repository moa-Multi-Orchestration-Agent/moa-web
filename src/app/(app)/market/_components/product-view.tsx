'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Markdown as ReactMarkdown } from '@/shared/ui/markdown';
import { CheckCircle2, CircleDashed, XCircle } from 'lucide-react';
import { LICENSE_LABEL, marketCategoryLabel, useProduct, useReviews, type LicenseType } from '@/entities/product';
import { useCurrentWorkspace } from '@/entities/workspace';
import { PurchaseDialog } from '@/features/market/purchase-dialog';
import { RatingBars, Stars } from '@/features/market/rating';
import { useSearchState } from '@/shared/hooks/use-search-state';
import { isApiError } from '@/shared/lib/api-client';
import { copy } from '@/shared/lib/copy';
import { formatDate, formatKrw, formatNumber, relativeTime } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Guarded } from '@/shared/ui/guarded';
import { LineTabs } from '@/shared/ui/line-tabs';
import { PageContainer } from '@/shared/ui/page-header';
import { Skeleton } from '@/shared/ui/skeleton';
import { EmptyState, ErrorState, ListSkeleton } from '@/shared/ui/states';

const REQ = { builtin: { t: '기본 제공', v: 'green' as const, i: CheckCircle2 }, connected: { t: '연결됨', v: 'green' as const, i: CheckCircle2 }, missing: { t: '연결 필요', v: 'red' as const, i: XCircle }, seller: { t: '제작자 환경에서 실행', v: 'gray' as const, i: CircleDashed } };

export function ProductView({ id }: { id: string }) {
  const [s, set] = useSearchState({ tab: 'overview' });
  const q = useProduct(id);
  const reviews = useReviews(id);
  const { can } = useCurrentWorkspace();
  const [license, setLicense] = useState<LicenseType | null>(null);
  const [buying, setBuying] = useState(false);

  if (q.isPending) return <PageContainer><Skeleton className="h-40" /><Skeleton className="h-96" /></PageContainer>;
  if (q.isError) return <PageContainer>{isApiError(q.error) && q.error.status === 404 ? <EmptyState title="상품을 찾을 수 없어요" action={<Button asChild><Link href="/market">마켓으로</Link></Button>} /> : <ErrorState error={q.error} onRetry={() => void q.refetch()} />}</PageContainer>;
  const p = q.data!;
  const lic = license ?? p.licenseTypes[0]!;
  const price = (t: LicenseType) => (t === 'clone' ? (p.priceCloneKrw ?? 0) : (p.priceApiMonthKrw ?? 0));
  const ownedClone = p.ownedLicense === 'clone' && lic === 'clone';
  const reasonBuy = p.mine ? '내 상품은 살 수 없어요' : ownedClone ? '이미 복제 라이선스가 있어요' : copy.common.adminOnly;

  const reviewList = (
    <div className="grid gap-6 md:grid-cols-[240px_1fr]">
      <div>
        <p className="text-3xl font-bold">{p.ratingAvg.toFixed(1)}</p>
        <Stars value={p.ratingAvg} />
        <p className="text-muted mb-3 text-xs">리뷰 {p.ratingCount}건</p>
        {reviews.data ? <RatingBars distribution={reviews.data.distribution} total={reviews.data.items.length} /> : null}
      </div>
      {reviews.isPending ? <ListSkeleton rows={3} /> : reviews.isError ? <ErrorState compact error={reviews.error} onRetry={() => void reviews.refetch()} /> : !reviews.data!.items.length ? <EmptyState title="아직 리뷰가 없어요" /> : (
        <ul className="divide-y">
          {reviews.data!.items.map((r) => (
            <li key={r.id} className="py-3">
              <p className="flex items-center gap-2 text-sm font-semibold">{r.author_name} <Stars value={r.rating} /> <span className="text-muted text-xs font-normal">{relativeTime(r.created_at)}</span></p>
              <p className="mt-1 text-sm">{r.body}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <PageContainer className="max-w-[1280px]">
      <nav aria-label="경로" className="text-muted text-sm">
        <Link href="/market" className="hover:underline">마켓</Link> › <Link href={`/market?category=${p.category}`} className="hover:underline">{marketCategoryLabel(p.category)}</Link> › {p.title}
      </nav>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="min-w-0 space-y-5">
          <header className="flex items-start gap-4">
            <span className="bg-surface flex size-16 shrink-0 items-center justify-center rounded-xl border text-3xl" aria-hidden>{p.icon}</span>
            <div className="min-w-0 flex-1">
              <div className="flex gap-1.5">
                <Badge variant={p.kind === 'agent' ? 'blue' : 'gray'}>{p.kind === 'agent' ? '에이전트' : '워크플로'}</Badge>
                {!p.licenseTypes.includes('clone') ? <Badge variant="orange">API 전용</Badge> : null}
              </div>
              <h1 className="text-[28px] font-bold">{p.title}</h1>
              <p className="text-muted flex flex-wrap items-center gap-1 text-sm">{p.sellerName} · <Stars value={p.ratingAvg} /> {p.ratingAvg.toFixed(1)} (리뷰 {p.ratingCount}) · 설치 {formatNumber(p.installCount)} · 최신 v{p.latestSemver}</p>
            </div>
            <Button variant="outline" disabled title="1차 범위 밖">제작자 팔로우</Button>
          </header>
          <LineTabs label="상품 탭" value={s.tab} onChange={(v) => set({ tab: v })} items={[{ value: 'overview', label: '개요' }, { value: 'preview', label: '구성 미리보기' }, { value: 'reviews', label: `리뷰 ${p.ratingCount}` }, { value: 'versions', label: '버전 기록' }]} />
          {s.tab === 'reviews' ? reviewList : s.tab === 'versions' ? (
            <ol className="divide-y rounded-lg border bg-card">
              {p.versions.map((v, i) => (
                <li key={v.id} className="flex gap-4 px-4 py-3 text-sm"><span className="w-16 font-mono font-semibold">v{v.semver}</span><span className="flex-1">{v.changelog}{i === 0 ? <Badge variant="green" className="ml-2">최신</Badge> : null}</span><span className="text-muted">{formatDate(v.created_at)}</span></li>
              ))}
            </ol>
          ) : s.tab === 'preview' ? (
            <div className="bg-card space-y-3 rounded-lg border p-5 text-sm">
              {!p.preview.public ? <p className="bg-surface text-muted rounded-md px-3 py-2">API 전용 라이선스는 모델 · 프롬프트가 비공개입니다.</p> : null}
              <p>모델: <b>{p.preview.model ?? '비공개'}</b></p>
              <p>스킬: {p.preview.skills.join(', ') || '없음'}</p>
              <p>워크플로: {p.preview.workflows.join(', ')}</p>
            </div>
          ) : (
            <>
              <p className="text-[15px] leading-7">{p.summary}</p>
              <section>
                <h2 className="mb-2 font-bold">설치 전에 필요한 연동</h2>
                <ul className="space-y-2">
                  {p.requirements.map((r) => { const x = REQ[r.status]; return (
                    <li key={r.label} className="bg-card flex items-center gap-2 rounded-lg border px-4 py-3 text-sm"><x.i className="size-4" aria-hidden /><span className="flex-1 font-medium">{r.label}</span><Badge variant={x.v}>{x.t}</Badge></li>
                  ); })}
                </ul>
              </section>
              <article className="bg-card rounded-lg border p-5 text-sm leading-7 [&_h2]:mt-2 [&_h2]:text-lg [&_h2]:font-bold [&_h3]:mt-3 [&_h3]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_ol>li]:list-decimal [&_table]:my-2 [&_td]:border [&_td]:px-2 [&_th]:border [&_th]:px-2 [&_blockquote]:text-muted [&_blockquote]:border-l-2 [&_blockquote]:pl-3">
                <ReactMarkdown>{p.readmeMd ?? ''}</ReactMarkdown>
              </article>
              <section>
                <h2 className="mb-2 font-bold">최근 리뷰</h2>
                {reviewList}
              </section>
            </>
          )}
        </div>
        <aside className="bg-card sticky top-4 space-y-3 rounded-lg border p-5" aria-label="라이선스 선택">
          <h2 className="font-bold">라이선스 선택</h2>
          <div role="radiogroup" aria-label="라이선스" className="space-y-2">
            {p.licenseTypes.map((t) => (
              <button key={t} type="button" role="radio" aria-checked={lic === t} onClick={() => setLicense(t)} className={cn('w-full rounded-lg border-2 p-4 text-left', lic === t ? 'border-primary bg-primary-soft/50' : 'border-border')}>
                <span className="flex justify-between font-semibold"><span>{t === 'api_sub' ? 'API 사용' : LICENSE_LABEL[t]}</span><span>{t === 'api_sub' ? `월 ${formatKrw(price(t))}` : formatKrw(price(t))}</span></span>
                <span className="text-muted mt-1 block text-xs">{t === 'api_sub' ? '제작자 환경에서 실행되고 결과만 받습니다. 스튜디오에 추가되어 채팅 · API로 쓸 수 있어요.' : '에이전트와 연결된 워크플로까지 내 스튜디오로 복제해 자유롭게 수정합니다. 재판매 불가.'}</span>
              </button>
            ))}
          </div>
          <Guarded allowed={can('market') && !p.mine && !ownedClone} reason={reasonBuy}>
            <Button className="w-full" onClick={() => setBuying(true)} data-testid="buy">{price(lic) === 0 ? '무료로 받기' : '구매하고 스튜디오에 추가'}</Button>
          </Guarded>
          <Button variant="outline" className="w-full" disabled title="1차 범위 밖">무료로 3회 실행해 보기</Button>
          <ul className="text-muted space-y-1 border-t pt-3 text-xs">
            <li>· 새 버전 자동 업데이트</li>
            <li>· 실행 토큰 비용은 내 워크스페이스에 청구</li>
            <li>· 7일 이내 환불 (실행 이력 없음 기준)</li>
          </ul>
          <div className="border-t pt-3 text-xs"><p className="font-semibold">{p.seller.name}</p><p className="text-muted">상품 {p.seller.product_count}개 · {formatDate(p.seller.joined_at)} 가입</p></div>
        </aside>
      </div>
      <PurchaseDialog productId={p.id} title={p.title} license={lic} amount={price(lic)} open={buying} onOpenChange={setBuying} />
    </PageContainer>
  );
}
