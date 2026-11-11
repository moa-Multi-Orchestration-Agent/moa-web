'use client';

import { useEffect, useState } from 'react';
import { buildCardNews, renderCardNews, type NewsEdition } from '@/entities/card-news';
import { copy } from '@/shared/lib/copy';

export function CardImages({ edition }: { edition: NewsEdition }) {
  const [urls, setUrls] = useState<string[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    let generated: string[] = [];
    setUrls([]);
    setError('');
    renderCardNews(buildCardNews(edition)).then((images) => {
      if (!active) return;
      generated = images.map((image) => URL.createObjectURL(image.blob));
      setUrls(generated);
    }).catch((e) => { if (active) setError((e as Error).message); });
    return () => { active = false; generated.forEach(URL.revokeObjectURL); };
  }, [edition]);
  if (error) return <p role="alert" className="text-danger rounded-lg border p-4">{error}</p>;
  if (!urls.length) return <div role="status" className="text-muted animate-pulse rounded-lg border p-8">{copy.cardNews.generating}</div>;
  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5" aria-label="최신 뉴스 카드 5장">
    {urls.map((url, i) => <figure key={url} className="overflow-hidden rounded-xl border bg-white shadow-sm">
      <a href={url} target="_blank" rel="noopener noreferrer" aria-label={`${i + 1}번 카드 크게 보기`}>
      {/* 브라우저에서 생성한 로컬 JPEG Blob URL. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={`국내 주식 뉴스 카드 ${i + 1} / 5`} className="aspect-[4/5] w-full object-contain" />
      </a>
      <figcaption className="flex items-center justify-between border-t px-3 py-3 text-xs"><span>{i === 0 ? '표지' : `뉴스 ${i}`}</span><a className="text-primary font-semibold hover:underline" href={url} download={`stock-news-${edition.edition_date}-${i + 1}.jpg`}>JPEG 저장</a></figcaption>
    </figure>)}
  </div>;
}
