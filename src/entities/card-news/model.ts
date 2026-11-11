import { z } from 'zod';

const webUrl = z.string().url().refine((v) => ['https:', 'http:'].includes(new URL(v).protocol), '기사 주소는 http 또는 https여야 합니다.');
export const newsArticleSchema = z.object({
  title: z.string().trim().min(1).max(90),
  summary: z.string().trim().min(1).max(180),
  source: z.string().trim().min(1).max(40),
  url: webUrl,
});
export type NewsArticle = z.infer<typeof newsArticleSchema>;
export const cardNewsInputSchema = z.object({
  title: z.string().trim().min(1).max(45),
  account: z.string().trim().regex(/^[a-zA-Z0-9_.]{1,30}$/),
  articles: z.array(newsArticleSchema).min(4, '서로 다른 기사 4건이 필요합니다.').max(20),
});
export type CardNewsInput = z.infer<typeof cardNewsInputSchema>;
export interface NewsCard {
  kind: 'cover' | 'article';
  title: string;
  body: string;
  source: string;
  url?: string;
}
export interface CardNewsDeck {
  title: string;
  account: string;
  cards: NewsCard[];
  caption: string;
}

/** 사실을 새로 생성하지 않고, 입력받은 문안·출처를 카드 다섯 장으로 구성한다. */
export function buildCardNews(input: unknown): CardNewsDeck {
  const data = cardNewsInputSchema.parse(input);
  const articles = data.articles.filter((a, i, all) => all.findIndex((b) => b.url === a.url) === i).slice(0, 4);
  if (articles.length < 4) throw new Error('중복 주소를 제외한 기사 4건이 필요합니다.');
  return {
    title: data.title,
    account: data.account,
    cards: [
      { kind: 'cover', title: data.title, body: '국내 주식 뉴스\n오늘 확인할 네 가지 소식', source: `@${data.account}` },
      ...articles.map((a): NewsCard => ({ kind: 'article', title: a.title, body: a.summary, source: a.source, url: a.url })),
    ],
    caption: `${data.title}\n\n${articles.map((a, i) => `${i + 1}. ${a.title}\n${a.summary}\n출처: ${a.source} ${a.url}`).join('\n\n')}\n\n#국내주식 #주식뉴스 #카드뉴스`,
  };
}
