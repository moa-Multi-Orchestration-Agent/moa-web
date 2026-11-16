'use client';

import { useEffect, useMemo, useState } from 'react';
import { buildCardNews, cardNewsInputSchema, renderCardNews } from '@/entities/card-news';
import { copy } from '@/shared/lib/copy';
import { EmptyState } from '@/shared/ui/states';

export function CardNewsOutput({ outputs }: { outputs: unknown[] }) {
  const parsed = outputs.map((output) => cardNewsInputSchema.safeParse((output as { bundle?: unknown } | null)?.bundle)).find((result) => result.success);
  const raw = parsed?.success ? JSON.stringify(parsed.data) : '';
  const input = useMemo(() => raw ? cardNewsInputSchema.parse(JSON.parse(raw)) : null, [raw]);
  const [urls, setUrls] = useState<string[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    let generated: string[] = [];
    setUrls([]);
    setError('');
    if (input) renderCardNews(buildCardNews(input)).then((images) => {
      if (!active) return;
      generated = images.map((image) => URL.createObjectURL(image.blob));
      setUrls(generated);
    }).catch((e) => { if (active) setError((e as Error).message); });
    return () => { active = false; generated.forEach(URL.revokeObjectURL); };
  }, [input]);
  if (!input) return <EmptyState className="p-5" title="카드 생성 결과" description={copy.cardNews.empty} />;
  if (error) return <p role="alert" className="text-danger p-4">{error}</p>;
  if (!urls.length) return <p role="status" className="text-muted p-4">{copy.cardNews.generating}</p>;
  return <div className="h-full space-y-3 overflow-auto p-4" aria-label="이 워크플로의 카드 생성 결과">
    {process.env.NEXT_PUBLIC_API_MOCKING === 'enabled' ? <p className="text-warning text-xs">{copy.cardNews.mockMode}</p> : null}
    <div className="grid grid-cols-5 gap-3">{urls.map((url, i) => <figure key={url} className="rounded-lg border p-1">
      <a href={url} target="_blank" rel="noopener noreferrer" aria-label={`${i + 1}번 카드 크게 보기`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={`워크플로 카드뉴스 ${i + 1} / 5`} className="aspect-[4/5] w-full rounded object-contain" />
      </a>
      <figcaption className="py-1 text-center text-xs"><a href={url} download={`moa-card-${i + 1}.jpg`} className="text-primary underline">{i + 1}장 JPEG 저장</a></figcaption>
    </figure>)}</div>
    <p className="text-muted text-xs">{copy.cardNews.note}</p>
    <details><summary className="cursor-pointer text-xs font-semibold">게시 문안·출처 확인</summary><p className="mt-2 whitespace-pre-wrap text-xs">{buildCardNews(input).caption}</p></details>
  </div>;
}
