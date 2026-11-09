import { describe, expect, it } from 'vitest';
import { nodeCatalogSchema } from '@/entities/workflow/model';
import { nodeColor, NODE_GROUP_COLORS } from '@/shared/ui/node-colors';
import { fakeOutput } from '../engine';
import { BLOCK_GROUPS, BLOCKS, makeNode } from '../fixtures/blocks';

describe('logic.map(병렬 맵)', () => {
  it('카탈로그 스키마를 통과하고 로직 그룹 색을 쓴다', () => {
    const block = nodeCatalogSchema.parse({ groups: BLOCK_GROUPS, blocks: BLOCKS }).blocks.find((b) => b.id === 'logic.map')!;
    expect(block).toMatchObject({ group: 'logic', type: 'map', icon: 'Layers' });
    expect(block.config).toEqual({ workflow_id: '', concurrency: 5, max_items: 20, item_timeout_s: 300, item_field: '', index_field: '' });
    expect(block.ports_out.map((p) => p.name)).toEqual(['results', 'errors', 'failed_count', 'stats']);
    expect(block.description).toContain('errors의 index');
    expect(nodeColor('map')).toBe(NODE_GROUP_COLORS.logic);
    // logic.parallel 바로 다음에 둔다
    const ids = BLOCKS.map((b) => b.id);
    expect(ids.indexOf('logic.map')).toBe(ids.indexOf('logic.parallel') + 1);
  });

  it('목 출력: 항목 수만큼 입력 순서대로, max_items를 넘는 항목은 건너뛴다', () => {
    const node = makeNode('m', 'logic.map', '병렬 맵', 0, 0, { max_items: 2, concurrency: 3 });
    const out = fakeOutput(node, { items: ['a', 'b', 'c'] }) as { results: { item: string }[]; errors: unknown[]; failed_count: number; stats: { skipped: number; peak_concurrency: number } };
    expect(out.results.map((r) => r.item)).toEqual(['a', 'b']);
    expect(out.errors).toEqual([]);
    expect(out.failed_count).toBe(0);
    expect(out.stats).toMatchObject({ skipped: 1, peak_concurrency: 2 });
    expect(fakeOutput(node, {})).toMatchObject({ results: [], stats: { skipped: 0 } });
  });
});
