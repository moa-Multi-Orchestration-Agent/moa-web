/**
 * 노드 타입 색은 이 파일 한 곳에서만 정의한다 (CLAUDE.md).
 * 팔레트 그룹 → 색. 노드 타입(design.md 2.2.3 HANDLERS)은 그룹에 속한다.
 */
export type NodeGroup = 'io' | 'llm' | 'tool' | 'logic' | 'data' | 'knowledge' | 'three_d' | 'human';

export const NODE_GROUP_COLORS: Record<NodeGroup, { accent: string; soft: string; label: string }> = {
  io: { accent: '#2A56C6', soft: 'rgba(42,86,198,0.10)', label: '입력·출력' },
  llm: { accent: '#7C4DDB', soft: 'rgba(124,77,219,0.10)', label: 'LLM' },
  tool: { accent: '#0E8A8A', soft: 'rgba(14,138,138,0.10)', label: '도구·MCP' },
  logic: { accent: '#B7791F', soft: 'rgba(183,121,31,0.12)', label: '로직' },
  data: { accent: '#3B7D3B', soft: 'rgba(59,125,59,0.10)', label: '데이터' },
  knowledge: { accent: '#C2417A', soft: 'rgba(194,65,122,0.10)', label: '지식' },
  three_d: { accent: '#D9622B', soft: 'rgba(217,98,43,0.10)', label: '3D' },
  human: { accent: '#C98A00', soft: 'rgba(201,138,0,0.12)', label: '사람·승인' },
};

export const NODE_TYPE_GROUP: Record<string, NodeGroup> = {
  input: 'io',
  output: 'io',
  llm: 'llm',
  tool: 'tool',
  http: 'tool',
  code: 'data',
  condition: 'logic',
  loop: 'logic',
  parallel: 'logic',
  kb_search: 'knowledge',
  three_d: 'three_d',
  approval: 'human',
};

export function nodeColor(type: string) {
  return NODE_GROUP_COLORS[NODE_TYPE_GROUP[type] ?? 'tool'];
}
