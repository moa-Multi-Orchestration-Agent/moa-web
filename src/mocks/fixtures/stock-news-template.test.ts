import { expect, it } from 'vitest';
import { validateDefinition } from '@/entities/workflow';
import { pickTemplate, type Template } from '@/entities/template';
import { STOCK_NEWS_INSTAGRAM_TEMPLATE, STOCK_NEWS_TEMPLATE } from './stock-news-template';
import { SEED_TEMPLATES } from './templates';

it('사용자의 이름과 설명으로 기존 자동 구성에서 워크플로를 고른다', () => {
  const selected = pickTemplate('주식 카드뉴스 인스타 업로드 정해진 시간마다 국내주식 뉴스를 스크랩해서 카드뉴스를 생성한후 인스타에 업로드하는 것을 돕습니다.', 'workflow', SEED_TEMPLATES as unknown as Template[]);
  expect(selected?.id).toBe('tpl-stock-news-instagram');
});

it.each([
  ['국내 주식 카드뉴스를 만들어 인스타그램에 업로드해줘', 'tpl-stock-news-instagram'],
  ['국내 주식 인스타그램용 카드뉴스 만들어줘', 'tpl-stock-news'],
  ['국내 주식 카드뉴스를 만들어줘. 인스타그램에 업로드하지 마', 'tpl-stock-news'],
])('설명 "%s"에 맞는 게시 흐름을 선택한다', (prompt, id) => {
  expect(pickTemplate(prompt, 'workflow', SEED_TEMPLATES as unknown as Template[])?.id).toBe(id);
});

it('게시 템플릿은 승인 결과로 게시하고 게시물 ID를 반환한다', () => {
  const definition = STOCK_NEWS_INSTAGRAM_TEMPLATE.definition;
  expect(definition.nodes).toHaveLength(7);
  expect(definition.edges).toEqual(expect.arrayContaining([
    expect.objectContaining({ source: 'approval', source_port: 'approved', target: 'instagram', target_port: 'approved' }),
    expect.objectContaining({ source: 'instagram', source_port: 'media_id', target: 'out', target_port: 'result' }),
  ]));
  expect(validateDefinition(definition).issues.filter((issue) => issue.severity === 'error')).toEqual([]);
});
it('예약·수집·LLM·카드·승인·결과의 포트를 올바르게 연결한다', () => {
  const d = STOCK_NEWS_TEMPLATE.definition;
  expect(d.nodes.map((n) => n.type)).toEqual(['input', 'tool', 'llm', 'tool', 'approval', 'output']);
  expect(d.nodes[0].config).toMatchObject({ cron: '0 7 * * *', timezone: 'Asia/Seoul' });
  expect(d.edges).toContainEqual(expect.objectContaining({ source: 'summary', source_port: 'json', target: 'cards', target_port: 'content' }));
  expect(d.edges).toContainEqual(expect.objectContaining({ source: 'news', source_port: 'articles', target: 'cards', target_port: 'sources' }));
  expect(validateDefinition(d).issues.filter((i) => i.severity === 'error')).toEqual([]);
});
