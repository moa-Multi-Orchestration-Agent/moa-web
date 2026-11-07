import { describe, expect, it } from 'vitest';
import { nodeCatalogSchema } from '@/entities/workflow/model';
import { nodeColor, NODE_GROUP_COLORS } from '@/shared/ui/node-colors';
import { fakeOutput } from '../engine';
import { BLOCK_GROUPS, BLOCKS, makeNode } from '../fixtures/blocks';

const catalog = () => nodeCatalogSchema.parse({ groups: BLOCK_GROUPS, blocks: BLOCKS });

describe('근로계약서 검토용 노드', () => {
  it('doc.pdf_extract: 카탈로그 스키마를 통과하고 지식 그룹 색을 쓴다', () => {
    const block = catalog().blocks.find((b) => b.id === 'doc.pdf_extract')!;
    expect(block).toMatchObject({ group: 'knowledge', type: 'doc_extract', config: { max_files: 10 } });
    expect(block.ports_in).toEqual([{ name: 'files', type: 'array', required: true, label: '파일 목록' }]);
    expect(nodeColor('doc_extract')).toBe(NODE_GROUP_COLORS.knowledge);
  });

  it('doc.pdf_extract 목 출력: 파일마다 filename을 남기고 max_files를 지킨다', () => {
    const node = makeNode('n1', 'doc.pdf_extract', '텍스트 추출', 0, 0, { max_files: 2 });
    const files = ['a.pdf', 'b.pdf', 'c.pdf'].map((filename) => ({ filename, data_base64: 'JVBERi0=' }));
    const out = fakeOutput(node, { files }) as { documents: { filename: string }[]; count: number };
    expect(out.count).toBe(2);
    expect(out.documents.map((d) => d.filename)).toEqual(['a.pdf', 'b.pdf']);
    expect(fakeOutput(node, {})).toMatchObject({ documents: [], count: 0 });
  });
});
