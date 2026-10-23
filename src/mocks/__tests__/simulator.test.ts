import { beforeEach, describe, expect, it } from 'vitest';
import type { RunDetailRow, RunRow } from '@/entities/run/model';
import type { ContextBlockRow } from '@/entities/context/model';
import type { Page } from '@/shared/lib/api-client';
import { db } from '../db';
import { api, fail, fresh, readEvents, waitFor } from './helpers';

beforeEach(() => fresh());

const wf = (name: string) => db.workflows.find((w) => w.name === name)!;
const status = async (id: string) => (await api.get<RunDetailRow>(`/runs/${id}`)).status;

describe('실행 시뮬레이터', () => {
  it('노드를 위상 순서대로: run.status → step.started → step.delta → step.finished → succeeded', async () => {
    const run = await api.post<RunRow>('/runs', { workflow_id: wf('사내 문서 Q&A').id, input: { question: '연차는?' } });
    const evs = await readEvents(run.id, { untilEvent: (e) => e.event === 'run.status' && e.data.includes('succeeded') });
    const names = evs.map((e) => e.event);
    expect(names[0]).toBe('run.status');
    expect(JSON.parse(evs[0]!.data).status).toBe('running');
    expect(names.at(-1)).toBe('run.status');
    expect(JSON.parse(evs.at(-1)!.data).status).toBe('succeeded');
    const started = evs.filter((e) => e.event === 'step.started').map((e) => JSON.parse(e.data).node_id);
    expect(started).toEqual(['in', 'rag', 'llm1', 'cite', 'out']);
    // LLM 노드는 글자 단위 토큰 30~80개
    const llmStep = JSON.parse(evs.find((e) => e.event === 'step.started' && e.data.includes('"llm1"'))!.data).step_id;
    const deltas = evs.filter((e) => e.event === 'step.delta' && JSON.parse(e.data).step_id === llmStep);
    expect(deltas.length).toBeGreaterThanOrEqual(30);
    expect(deltas.length).toBeLessThanOrEqual(80);
    // 각 노드는 started 다음에 finished
    for (const id of started) {
      const s = names.findIndex((_, i) => evs[i]!.event === 'step.started' && evs[i]!.data.includes(`"node_id":"${id}"`));
      const f = names.findIndex((_, i) => evs[i]!.event === 'step.finished' && evs[i]!.data.includes(`"node_id":"${id}"`));
      expect(f).toBeGreaterThan(s);
    }
    expect(names).toContain('context.changed');
  });

  it('입력에 fail이 있으면 중간 노드가 실패하고 오류 코드를 남긴다', async () => {
    const run = await api.post<RunRow>('/runs', { workflow_id: wf('사내 문서 Q&A').id, input: { question: 'please fail' } });
    await waitFor(async () => (await status(run.id)) === 'failed');
    const d = await api.get<RunDetailRow>(`/runs/${run.id}`);
    expect(d.error_code).toMatch(/^MOA-/);
    expect(d.steps.some((s) => s.ok === false && s.attempt === 3)).toBe(true);
  });

  it('승인 노드: waiting_approval → 승인하면 이어서 succeeded', async () => {
    const run = await api.post<RunRow>('/runs', { workflow_id: wf('AI 뉴스 요약 발송').id, input: { topic: 'AI' } });
    const evs = await readEvents(run.id, { untilEvent: (e) => e.event === 'approval.required' });
    const apr = JSON.parse(evs.find((e) => e.event === 'approval.required')!.data);
    expect(await status(run.id)).toBe('waiting_approval');
    await api.post(`/approvals/${apr.approval_id}/decision`, { approve: true, comment: '좋아요' });
    await waitFor(async () => (await status(run.id)) === 'succeeded');
    expect((await fail(api.post(`/approvals/${apr.approval_id}/decision`, { approve: true }))).code).toBe('MOA-APR-001');
  });

  it('거부하면 failed(MOA-APR-002), 취소하면 canceled', async () => {
    const r1 = await api.post<RunRow>('/runs', { workflow_id: wf('AI 뉴스 요약 발송').id, input: {} });
    await waitFor(async () => (await status(r1.id)) === 'waiting_approval');
    const apr = db.approvals.find((a) => a.run_id === r1.id)!;
    await api.post(`/approvals/${apr.id}/decision`, { approve: false });
    const d = await api.get<RunDetailRow>(`/runs/${r1.id}`);
    expect([d.status, d.error_code]).toEqual(['failed', 'MOA-APR-002']);

    const r2 = await api.post<RunRow>('/runs', { workflow_id: wf('컨셉 3D 시각화 파이프라인').id, input: { sketch: 's', description: 'd' } });
    await api.post(`/runs/${r2.id}/cancel`);
    expect(await status(r2.id)).toBe('canceled');
    expect((await fail(api.post(`/runs/${r2.id}/cancel`))).code).toBe('MOA-RUN-001');
  });

  it('3D 노드는 glb URL과 미리보기를 돌려준다', async () => {
    const run = await api.post<RunRow>('/runs', { workflow_id: wf('컨셉 3D 시각화 파이프라인').id, input: { sketch: 's', description: 'd' } });
    await waitFor(async () => (await status(run.id)) === 'waiting_approval');
    const d = await api.get<RunDetailRow>(`/runs/${run.id}`);
    expect(d.assets[0]!.url).toMatch(/\.glb$/);
    expect(d.assets[0]!.preview_url).toMatch(/\.png$/);
  });

  it('Last-Event-ID 이후 이벤트만 다시 보낸다', async () => {
    const run = await api.post<RunRow>('/runs', { workflow_id: wf('문의 분류').id, input: { subject: 'a', body: 'b' } });
    await waitFor(async () => (await status(run.id)) === 'succeeded');
    const all = await readEvents(run.id);
    const tail = await readEvents(run.id, { lastEventId: 5 });
    expect(tail[0]!.id).toBe('6');
    expect(tail.length).toBe(all.length - 5);
  });

  it('에이전트 대화: 같은 세션을 이어 쓰고 컨텍스트가 70%를 넘으면 압축 이벤트', async () => {
    const agent = db.agents[0]!;
    const r1 = await api.post<RunRow>('/runs', { agent_id: agent.id, input: { message: '접이식 의자 3D 컨셉 잡아줘' } });
    await waitFor(async () => (await status(r1.id)) === 'succeeded');
    let compressed = false;
    let last = r1;
    for (let i = 0; i < 6 && !compressed; i++) {
      last = await api.post<RunRow>('/runs', { agent_id: agent.id, input: { message: `더 자세히 ${i}` }, context_session_id: r1.context_session_id });
      const evs = await readEvents(last.id, { untilEvent: (e) => e.event === 'run.status' && /succeeded|failed/.test(e.data) });
      compressed = evs.some((e) => e.event === 'context.changed' && JSON.parse(e.data).compressed);
    }
    expect(last.context_session_id).toBe(r1.context_session_id);
    expect(compressed).toBe(true);
    const blocks = await api.get<Page<ContextBlockRow>>(`/context/sessions/${r1.context_session_id}/blocks`);
    expect(blocks.items.some((b) => b.role === 'summary')).toBe(true);
    expect(blocks.items.some((b) => b.compressed_into && !b.enabled)).toBe(true);
  });

  it('컨텍스트 블록 PATCH: 오래된 If-Match는 409 MOA-CTX-003', async () => {
    const blk = db.context_blocks.find((b) => !b.pinned)!;
    await api.patch(`/context/blocks/${blk.id}`, { enabled: false }, { ifMatch: blk.version });
    const e = await fail(api.patch(`/context/blocks/${blk.id}`, { enabled: true }, { ifMatch: 1 }));
    expect([e.status, e.code]).toEqual([409, 'MOA-CTX-003']);
  });

  it('월 예산을 넘으면 POST /runs가 402', async () => {
    db.budgets.find((b) => b.scope_type === 'workspace')!.monthly_limit_usd = 0;
    const e = await fail(api.post('/runs', { workflow_id: wf('문의 분류').id, input: {} }));
    expect([e.status, e.code]).toEqual([402, 'MOA-BUD-001']);
  });
});

describe('시드 데이터 수량', () => {
  it('prompts.md 2단계 5) 기준', () => {
    expect(db.workspaces).toHaveLength(2);
    expect(db.memberships.filter((m) => m.workspace_id === db.workspaces[0]!.id)).toHaveLength(4);
    expect(db.agents.filter((a) => a.workspace_id === db.workspaces[0]!.id)).toHaveLength(6);
    const wfs = db.workflows.filter((w) => w.workspace_id === db.workspaces[0]!.id);
    expect(wfs).toHaveLength(8);
    expect(wfs.every((w) => w.draft.nodes.length >= 4 && w.draft.nodes.length <= 10)).toBe(true);
    expect(db.runs.filter((r) => r.workspace_id === db.workspaces[0]!.id)).toHaveLength(30);
    expect(new Set(db.runs.map((r) => r.status))).toEqual(new Set(['succeeded', 'failed', 'waiting_approval', 'canceled']));
    expect(db.templates).toHaveLength(24);
    expect(new Set(db.templates.map((t) => t.category)).size).toBe(8);
    expect(db.market_products.filter((p) => p.status === 'published')).toHaveLength(12);
    expect(db.endpoints.filter((e) => e.workspace_id === db.workspaces[0]!.id)).toHaveLength(3);
    expect(db.api_keys).toHaveLength(2);
    expect(db.mcp_servers).toHaveLength(3);
    expect(db.credentials).toHaveLength(3);
  });
});
