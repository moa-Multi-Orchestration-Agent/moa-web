import { expect, it } from 'vitest';
import { validateDefinition } from '@/entities/workflow';
import { pickTemplate, type Template } from '@/entities/template';
import { STOCK_NEWS_TEMPLATE } from './stock-news-template';
import { SEED_TEMPLATES } from './templates';

it('사용자의 이름과 설명으로 기존 자동 구성에서 워크플로를 고른다', () => {
  const selected = pickTemplate('주식 카드뉴스 인스타 업로드 정해진 시간마다 국내주식 뉴스를 스크랩해서 카드뉴스를 생성한후 인스타에 업로드하는 것을 돕습니다.', 'workflow', SEED_TEMPLATES as unknown as Template[]);
  expect(selected?.id).toBe('tpl-stock-news');
});
it('예약·수집·LLM·카드·승인·결과의 포트를 올바르게 연결한다', () => {
  const d = STOCK_NEWS_TEMPLATE.definition;
  expect(d.nodes.map((n) => n.type)).toEqual(['input', 'tool', 'llm', 'tool', 'approval', 'output']);
  expect(d.nodes[0].config).toMatchObject({ cron: '0 7 * * *', timezone: 'Asia/Seoul' });
  expect(d.edges).toContainEqual(expect.objectContaining({ source: 'summary', source_port: 'json', target: 'cards', target_port: 'content' }));
  expect(d.edges).toContainEqual(expect.objectContaining({ source: 'news', source_port: 'articles', target: 'cards', target_port: 'sources' }));
  expect(validateDefinition(d).issues.filter((i) => i.severity === 'error')).toEqual([]);
});
