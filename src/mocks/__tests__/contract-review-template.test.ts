import { beforeEach, describe, expect, it } from 'vitest';
import { validateDefinition } from '@/entities/workflow/graph';
import type { RunDetailRow, RunRow } from '@/entities/run/model';
import { CONTRACT_LABELS } from '@/entities/workflow/contract-presets';
import { db } from '../db';
import { SEED_TEMPLATES } from '../fixtures/templates';
import { api, fresh, readEvents } from './helpers';

beforeEach(() => fresh());

const tpl = () => SEED_TEMPLATES.find((t) => t.id === 'tpl-25')!;

describe('계약서 검토 템플릿(tpl-25)', () => {
  it('맨 뒤에 추가되어 기존 24개 템플릿 순서를 바꾸지 않는다', () => {
    expect(SEED_TEMPLATES.map((t) => t.id)).toEqual(['tpl-stock-news', ...Array.from({ length: 24 }, (_, i) => `tpl-${String(i + 1).padStart(2, '0')}`), 'tpl-25']);
    expect(tpl()).toMatchObject({ name: '계약서 검토', category: 'data', kind: 'workflow', trigger: 'manual', required_connections: [] });
  });

  it('계약서마다 하위 워크플로를 병렬 맵으로 부르고, 검증 오류가 없다', () => {
    const { nodes, edges } = tpl().definition;
    expect(nodes.map((n) => n.block)).toEqual(['input.manual', 'doc.pdf_extract', 'logic.map', 'data.code', 'llm.summarize', 'data.template', 'output.result']);
    expect(validateDefinition({ nodes, edges }).issues.filter((i) => i.severity === 'error')).toEqual([]);
    expect(nodes.find((n) => n.block === 'logic.map')!.config).toMatchObject({ workflow_id: 'subflow:item', item_field: 'document', concurrency: 5 });
    expect(edges.some((e) => e.condition === 'loop_back')).toBe(false);
    expect(nodes.find((n) => n.id === 'in')!.ports_out).toEqual([{ name: 'files', type: 'array', label: 'files' }]);
  });

  it('하위 워크플로 "계약서 1건 검토": 종류 분류 → 계약서 검토', () => {
    const [sub] = tpl().subflows ?? [];
    expect(sub).toMatchObject({ key: 'item', name: '계약서 1건 검토' });
    const { nodes, edges } = sub!.definition;
    expect(nodes.map((n) => n.block)).toEqual(['input.manual', 'llm.classify', 'llm.risk_check', 'output.result']);
    expect(validateDefinition({ nodes, edges }).issues.filter((i) => i.severity === 'error')).toEqual([]);
    expect(nodes.find((n) => n.block === 'llm.classify')!.config.labels).toEqual([...CONTRACT_LABELS]);
    expect(nodes.find((n) => n.block === 'llm.risk_check')!.config).toMatchObject({ document: '{{in.output.document}}', preset: 'labor' });
  });

  it('복제하면 하위 워크플로도 만들고 병렬 맵이 그것을 가리킨다', async () => {
    const inst = await api.post<{ workflow_id: string }>('/templates/tpl-25/instantiate', { name: '임대차 검토' });
    const main = db.workflows.find((w) => w.id === inst.workflow_id)!;
    const sub = db.workflows.find((w) => w.name === '임대차 검토 · 계약서 1건 검토')!;
    expect(main.name).toBe('임대차 검토');
    expect(main.draft.nodes.find((n) => n.block === 'logic.map')!.config.workflow_id).toBe(sub.id);
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
