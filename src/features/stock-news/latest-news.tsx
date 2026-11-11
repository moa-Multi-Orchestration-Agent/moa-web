'use client';

import Link from 'next/link';
import { toast } from 'sonner';
import { buildCardNews, useLatestStockNews, useRefreshStockNews } from '@/entities/card-news';
import { useCurrentWorkspace } from '@/entities/workspace';
import { copy } from '@/shared/lib/copy';
import { Button } from '@/shared/ui/button';
import { PageContainer, PageHeader } from '@/shared/ui/page-header';
import { EmptyState, ErrorState, ListSkeleton } from '@/shared/ui/states';
import { CardImages } from './card-images';

const c = copy.cardNews;
export function LatestNews() {
  const query = useLatestStockNews();
  const refresh = useRefreshStockNews();
  const { can } = useCurrentWorkspace();
  const mock = process.env.NEXT_PUBLIC_API_MOCKING === 'enabled';
  const data = query.data;
  const edition = data?.edition;
  const working = data?.status === 'running' || refresh.isPending;
  return <PageContainer className="max-w-[1600px] space-y-6">
    <PageHeader title={c.latest} description="매일 오전 7시 · 한국 시간 · 국내 뉴스 4건 + 표지 1장" />
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4 text-sm">
      <div className="space-y-1"><p className="font-semibold">{edition ? `${edition.edition_date} · ${c.ready}` : c.noNews}</p><p className="text-muted text-xs">{data?.scheduler_enabled ? data.schedule : c.scheduleOff}</p></div>
      <Button variant="outline" disabled={mock || working || !can('manageKeys')} onClick={() => refresh.mutate(undefined, { onError: (e) => toast.error(e.message) })}>{working ? c.collecting : c.refresh}</Button>
    </div>
    {mock ? <p role="status" className="bg-warning-soft rounded-lg p-4 text-sm">{c.mockMode}</p> : null}
    {query.isPending ? <ListSkeleton rows={5} /> : query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : null}
    {data?.error ? <p role="alert" className="text-danger rounded-lg border p-4">{data.error}</p> : null}
    {!query.isPending && !query.isError && !edition ? <EmptyState title={working ? c.collecting : c.noNews} description={c.emptyHelp} action={<Link className="text-primary underline" href="/integrations?tab=model-keys">모델 키 연동 확인</Link>} /> : null}
    {edition ? <>
      <div className="text-muted flex flex-wrap gap-4 text-xs"><span>{new Date(edition.generated_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} 수집본</span><span>{c.format}</span><span>@{edition.account}</span></div>
      <CardImages edition={edition} />
      <section className="space-y-4 rounded-xl border p-5" aria-label="뉴스 출처와 게시 문안">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-bold">{c.caption}</h2><a className="text-primary text-sm underline" href={`data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(edition, null, 2))}`} download={`stock-news-${edition.edition_date}.json`}>{c.captionDownload}</a></div>
        <p className="text-muted text-xs">{c.note}</p>
        <div className="grid gap-4 md:grid-cols-2">{edition.articles.map((a, i) => <article key={a.url} className="space-y-2 rounded-lg bg-surface p-4"><h3 className="text-sm font-semibold">{i + 1}. {a.title}</h3><p className="text-sm">{a.summary}</p><a href={a.url} target="_blank" rel="noopener noreferrer" className="text-primary text-xs underline">{a.source} · 원문 보기</a></article>)}</div>
        <details><summary className="cursor-pointer text-sm font-semibold">인스타그램 게시 문안 보기</summary><p className="mt-3 whitespace-pre-wrap text-sm">{buildCardNews(edition).caption}</p></details>
      </section>
    </> : null}
  </PageContainer>;
}
