import { beforeEach, describe, expect, it } from 'vitest';
import { validateDefinition } from '@/entities/workflow/graph';
import type { RunDetailRow, RunRow } from '@/entities/run/model';
import { SEED_TEMPLATES } from '../fixtures/templates';
import { api, fresh, readEvents } from './helpers';

beforeEach(() => fresh());

const tpl = () => SEED_TEMPLATES.find((t) => t.id === 'tpl-25')!;

describe('근로계약서 검토 템플릿(tpl-25)', () => {
  it('맨 뒤에 추가되어 기존 24개 템플릿 순서를 바꾸지 않는다', () => {
    expect(SEED_TEMPLATES.map((t) => t.id)).toEqual([...Array.from({ length: 24 }, (_, i) => `tpl-${String(i + 1).padStart(2, '0')}`), 'tpl-25']);
    expect(tpl()).toMatchObject({ name: '근로계약서 검토', category: 'data', kind: 'workflow', trigger: 'manual', required_connections: [] });
  });

  it('검증 오류 없이 반복(loop_back) 구조를 갖는다', () => {
    const { nodes, edges } = tpl().definition;
    expect(nodes.map((n) => n.block)).toEqual(['input.manual', 'doc.pdf_extract', 'logic.loop', 'llm.classify', 'llm.risk_check', 'logic.collect', 'llm.summarize', 'data.template', 'output.result']);
    const { issues } = validateDefinition({ nodes, edges });
    expect(issues.filter((i) => i.severity === 'error')).toEqual([]);
    expect(edges.find((e) => e.condition === 'loop_back')).toMatchObject({ source: 'n5', source_port: 'next', target: 'n2', target_port: 'items' });
    // 위험 검사는 반복 노드에 직접 잇지 않고 config 바인딩으로 계약서를 받는다(두 번 실행 방지)
    expect(edges.some((e) => e.source === 'n2' && e.target === 'n4')).toBe(false);
    expect(nodes.find((n) => n.id === 'n4')!.config.document).toBe('{{n2.output.item}}');
    expect(nodes.find((n) => n.id === 'in')!.ports_out).toEqual([{ name: 'files', type: 'array', label: 'files' }]);
  });

  it('복제해서 목 모드로 실행하면 끝까지 돈다', async () => {
    const inst = await api.post<{ workflow_id: string }>('/templates/tpl-25/instantiate', {});
    const files = [{ filename: '01-clean.pdf', data_base64: 'JVBERi0=' }];
    const run = await api.post<RunRow>('/runs', { workflow_id: inst.workflow_id, input: { files } });
    await readEvents(run.id, { untilEvent: (e) => e.event === 'run.status' && /succeeded|failed/.test(e.data) });
    const detail = await api.get<RunDetailRow>(`/runs/${run.id}`);
    expect(detail.status).toBe('succeeded');
  });
});
