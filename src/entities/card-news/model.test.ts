import { expect, it } from 'vitest';
import { buildCardNews } from './model';

const input = () => ({ title: '국내 주식 브리핑', account: 'ryorlr_moa', articles: Array.from({ length: 4 }, (_, i) => ({ title: `기사 ${i}`, summary: '확인한 요약', source: '테스트 매체', url: `https://example.com/${i}` })) });
it('표지와 기사 4건으로 정확히 5장, 출처 포함 문안을 만든다', () => {
  const deck = buildCardNews(input());
  expect(deck.cards).toHaveLength(5);
  expect(deck.cards[0].kind).toBe('cover');
  expect(deck.caption).toContain('https://example.com/3');
  expect(deck.cards[1].body).toBe('확인한 요약');
});
it('누락·중복 기사나 실행 가능한 URL은 거부한다', () => {
  const data = input();
  data.articles[3].url = data.articles[0].url;
  expect(() => buildCardNews(data)).toThrow('기사 4건');
  data.articles[3].url = 'javascript:alert(1)';
  expect(() => buildCardNews(data)).toThrow();
  expect(() => buildCardNews({ ...input(), articles: [] })).toThrow();
});
