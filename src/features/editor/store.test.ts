import { beforeEach, describe, expect, it } from 'vitest';
import { SEED_WORKFLOWS } from '@/mocks/fixtures/workflows';
import { BLOCKS } from '@/mocks/fixtures/blocks';
import { fromDefinition, nextNodeId, nodeFromBlock, toDefinition } from './convert';
import { redo, undo, useEditorStore } from './store';
import { autoLayout } from './layout';

const wf = SEED_WORKFLOWS.find((w) => w.key === 'docsqa')!;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

beforeEach(() => {
  useEditorStore.getState().init({ id: 'w1', draft: structuredClone(wf.definition), draft_version: 3 });
});

describe('convert', () => {
  it('정의 → React Flow → 정의 왕복이 같다', () => {
    const { nodes, edges } = fromDefinition(wf.definition);
    const back = toDefinition(nodes, edges);
    expect(back.nodes.map((n) => n.id)).toEqual(wf.definition.nodes.map((n) => n.id));
    expect(back.edges.map((e) => [e.source, e.source_port, e.target, e.target_port])).toEqual(wf.definition.edges.map((e) => [e.source, e.source_port, e.target, e.target_port]));
  });
  it('새 노드 id는 겹치지 않는다', () => {
    const b = BLOCKS.find((x) => x.id === 'llm.generate')!;
    expect(nextNodeId([{ id: 'llm1' }, { id: 'llm2' }], b)).toBe('llm3');
  });
});

describe('editor store', () => {
  it('serverVersion과 dirty를 관리한다', () => {
    const s = useEditorStore.getState();
    expect(s.serverVersion).toBe(3);
    expect(s.dirty).toBe(false);
    s.updateConfig('llm1', { prompt: '새 프롬프트' });
    expect(useEditorStore.getState().dirty).toBe(true);
    useEditorStore.getState().markSaved(4, [{ code: 'MOA-WF-002', node_id: 'llm1', message: 'x', severity: 'warn', port: null }]);
    expect(useEditorStore.getState()).toMatchObject({ serverVersion: 4, dirty: false });
    expect(useEditorStore.getState().issues.llm1).toHaveLength(1);
  });

  it('실행 취소·다시 실행', async () => {
    const before = useEditorStore.getState().nodes.length;
    const b = BLOCKS.find((x) => x.id === 'tool.web_search')!;
    await wait(450);
    useEditorStore.getState().addNode(nodeFromBlock(b, 'tool1', { x: 0, y: 0 }));
    expect(useEditorStore.getState().nodes).toHaveLength(before + 1);
    undo();
    expect(useEditorStore.getState().nodes).toHaveLength(before);
    redo();
    expect(useEditorStore.getState().nodes).toHaveLength(before + 1);
  });

  it('설정 수정은 이전 상태를 건드리지 않고(immer) 실행 취소로 되돌린다', async () => {
    await wait(450);
    const prev = useEditorStore.getState().nodes;
    const prevPrompt = prev.find((n) => n.id === 'llm1')!.data.config.prompt;
    useEditorStore.getState().updateConfig('llm1', { prompt: '바뀐 프롬프트' });
    const next = useEditorStore.getState().nodes;
    expect(next).not.toBe(prev);
    expect(prev.find((n) => n.id === 'llm1')!.data.config.prompt).toBe(prevPrompt);
    expect(next.find((n) => n.id === 'llm1')!.data.config.prompt).toBe('바뀐 프롬프트');
    // 바뀌지 않은 노드는 같은 참조를 유지한다
    expect(next.find((n) => n.id !== 'llm1')).toBe(prev.find((n) => n.id !== 'llm1'));
    undo();
    expect(useEditorStore.getState().nodes.find((n) => n.id === 'llm1')!.data.config.prompt).toBe(prevPrompt);
  });

  it('선택 삭제는 연결된 엣지도 지운다', () => {
    useEditorStore.getState().selectOnly('rag');
    useEditorStore.getState().deleteSelected();
    const s = useEditorStore.getState();
    expect(s.nodes.some((n) => n.id === 'rag')).toBe(false);
    expect(s.edges.some((e) => e.source === 'rag' || e.target === 'rag')).toBe(false);
  });

  it('복사·붙여넣기는 새 id와 내부 엣지를 만든다', () => {
    const s = useEditorStore.getState();
    useEditorStore.setState({ nodes: s.nodes.map((n) => ({ ...n, selected: n.id === 'rag' || n.id === 'llm1' })) });
    useEditorStore.getState().copySelection();
    useEditorStore.getState().paste();
    const after = useEditorStore.getState();
    expect(after.nodes.map((n) => n.id)).toEqual(expect.arrayContaining(['rag_copy', 'llm1_copy']));
    expect(after.edges.some((e) => e.source === 'rag_copy' && e.target === 'llm1_copy')).toBe(true);
  });

  it('충돌: 서버 것 불러오기는 서버본으로, 덮어쓰기는 If-Match를 서버 버전으로', () => {
    const server = { id: 'w1', draft: { nodes: wf.definition.nodes.slice(0, 2), edges: [] }, draft_version: 9 };
    useEditorStore.getState().adoptServerVersion(9);
    expect(useEditorStore.getState()).toMatchObject({ serverVersion: 9, dirty: true, conflict: null });
    useEditorStore.getState().loadServer(server);
    expect(useEditorStore.getState().nodes).toHaveLength(2);
    expect(useEditorStore.getState().dirty).toBe(false);
  });

  it('자동 정렬은 위상 순서대로 왼쪽→오른쪽', () => {
    const s = useEditorStore.getState();
    const laid = autoLayout(s.nodes, s.edges);
    const x = (id: string) => laid.find((n) => n.id === id)!.position.x;
    expect(x('in')).toBeLessThan(x('rag'));
    expect(x('rag')).toBeLessThan(x('llm1'));
    expect(x('llm1')).toBeLessThan(x('out'));
  });
});
