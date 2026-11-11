import { expect, it } from 'vitest';
import { validateDefinition } from '@/entities/workflow/graph';
import { chain, SEED_TEMPLATES } from './templates';

it('뉴스레터는 검색 배열을 참고 자료로, 주제 문자열을 질문으로 연결한다', () => {
  const { definition } = SEED_TEMPLATES.find((t) => t.id === 'tpl-17')!;
  expect(definition.edges).toEqual(expect.arrayContaining([
    expect.objectContaining({ source: 'n1', source_port: 'results', target: 'n2', target_port: 'context' }),
    expect.objectContaining({ source: 'in', source_port: 'topic', target: 'n2', target_port: 'query' }),
  ]));
  expect(validateDefinition(definition).issues.filter((i) => i.severity === 'error')).toEqual([]);
});

it('호환 포트가 없으면 잘못된 연결을 생성하지 않는다', () => {
  const def = chain([['input.manual', '시작'], ['tool.web_search', '검색'], ['data.csv', 'CSV']]);
  expect(def.edges.some((e) => e.source === 'n1' && e.target === 'n2')).toBe(false);
  expect(validateDefinition(def).issues.filter((i) => i.code === 'MOA-WF-003')).toEqual([]);
});
