import { beforeEach, describe, expect, it } from 'vitest';
import type { AgentDetailRow, AgentRow } from '@/entities/agent/model';
import type { WorkflowDetailRow } from '@/entities/workflow/model';
import type { Page } from '@/shared/lib/api-client';
import { setWorkspaceId } from '@/shared/lib/api-client';
import { db } from '../db';
import { api, fail, fresh, WS2 } from './helpers';

beforeEach(() => fresh());

describe('auth', () => {
  it('아무 이메일로 로그인되고, 로그아웃하면 /auth/me가 401', async () => {
    const r = await api.post<{ user: { email: string } }>('/auth/login', { email: 'x@y.com', password: 'whatever1' });
    expect(r.user.email).toBe('x@y.com');
    await api.post('/auth/logout');
    expect((await fail(api.get('/auth/me'))).status).toBe(401);
    await api.post('/auth/login', { email: 'demo@moa.dev', password: 'whatever1' });
    expect((await api.get<{ user: unknown }>('/auth/me')).user).toBeTruthy();
  });
  it('wrong-password는 401 MOA-AUTH-001', async () => {
    const e = await fail(api.post('/auth/login', { email: 'a@b.c', password: 'wrong-password' }));
    expect([e.status, e.code]).toEqual([401, 'MOA-AUTH-001']);
  });
});

describe('workspaces · 권한', () => {
  it('워크스페이스 2개(owner, viewer)', async () => {
    const r = await api.get<Page<{ role: string }>>('/workspaces');
    expect(r.items.map((w) => w.role).sort()).toEqual(['owner', 'viewer']);
  });
  it('viewer 워크스페이스에서는 생성이 403', async () => {
    setWorkspaceId(WS2);
    const e = await fail(api.post('/agents', { name: '새 에이전트' }));
    expect([e.status, e.code]).toEqual([403, 'MOA-AUTH-003']);
  });
  it('owner 역할은 바꿀 수 없다', async () => {
    const e = await fail(api.patch(`/workspaces/${db.workspaces[0]!.id}/members/${db.session.userId}`, { role: 'maker' }));
    expect(e.status).toBe(409);
  });
  it('?mock_error로 원하는 오류를 받는다', async () => {
    const e = await fail(api.get('/agents', { query: { mock_error: 'MOA-SYS-503' } }));
    expect([e.status, e.code, e.retryable]).toEqual([503, 'MOA-SYS-503', true]);
  });
});

describe('agents', () => {
  it('커서 페이지네이션', async () => {
    const p1 = await api.get<Page<AgentRow>>('/agents', { query: { limit: 4 } });
    expect(p1.items).toHaveLength(4);
    expect(p1.next_cursor).toBeTruthy();
    const p2 = await api.get<Page<AgentRow>>('/agents', { query: { limit: 4, cursor: p1.next_cursor! } });
    expect(p2.items.length).toBe(2);
    expect(p2.next_cursor).toBeNull();
  });
  it('생성·수정·복제·삭제가 목록에 반영된다', async () => {
    const a = await api.post<AgentDetailRow>('/agents', { name: '테스트 에이전트' });
    await api.patch(`/agents/${a.id}`, { temperature: 1.1 });
    const dup = await api.post<AgentDetailRow>(`/agents/${a.id}/duplicate`);
    expect(dup.name).toBe('테스트 에이전트 (사본)');
    let list = await api.get<Page<AgentRow>>('/agents', { query: { limit: 50, q: '테스트' } });
    expect(list.items.map((x) => x.temperature)).toEqual([1.1, 1.1]);
    await api.delete(`/agents/${a.id}`);
    list = await api.get<Page<AgentRow>>('/agents', { query: { limit: 50, q: '테스트' } });
    expect(list.items).toHaveLength(1);
  });
  it('스킬 부착: destructive MCP 도구는 승인이 기본으로 켜짐', async () => {
    const a = await api.post<AgentDetailRow>('/agents', { name: 'x' });
    const merge = db.mcp_tools.find((t) => t.name === 'merge_pull_request')!;
    const r = await api.post<AgentDetailRow>(`/agents/${a.id}/skills`, { mcp_tool_id: merge.id });
    expect(r.skills[0]!.require_approval).toBe(true);
    expect((await fail(api.post(`/agents/${a.id}/skills`, { mcp_tool_id: merge.id }))).status).toBe(409);
  });
  it('필터: 배포됨·구매함', async () => {
    const d = await api.get<Page<AgentRow>>('/agents', { query: { filter: 'deployed', limit: 50 } });
    expect(d.items.every((a) => a.endpoint_count > 0)).toBe(true);
    const p = await api.get<Page<AgentRow>>('/agents', { query: { filter: 'purchased', limit: 50 } });
    expect(p.items.map((a) => a.name)).toEqual(['경쟁사 분석 에이전트']);
  });
});

describe('workflows', () => {
  it('초안 저장: If-Match가 맞으면 draft_version+1, 틀리면 409', async () => {
    const w = await api.get<WorkflowDetailRow>(`/workflows/${db.workflows[0]!.id}`);
    const ok = await api.put<{ draft_version: number; issues: unknown[] }>(`/workflows/${w.id}/draft`, w.draft, { ifMatch: w.draft_version });
    expect(ok.draft_version).toBe(w.draft_version + 1);
    const e = await fail(api.put(`/workflows/${w.id}/draft`, w.draft, { ifMatch: w.draft_version }));
    expect([e.status, e.code]).toEqual([409, 'MOA-WF-009']);
  });
  it('검증: 순환·미연결 필수 입력·시작 노드 없음', async () => {
    const w = await api.get<WorkflowDetailRow>(`/workflows/${db.workflows[0]!.id}`);
    const nodes = w.draft.nodes.filter((n) => n.type !== 'input');
    const cyc = { nodes, edges: [...w.draft.edges.filter((e) => e.source !== 'in'), { source: 'out', source_port: 'x', target: 'rag', target_port: 'query' }, { source: 'apr', source_port: 'approved', target: 'out', target_port: 'result' }] };
    const r = await api.post<{ issues: { code: string }[] }>(`/workflows/${w.id}/validate`, cyc);
    const codes = r.issues.map((i) => i.code);
    expect(codes).toContain('MOA-WF-004');
    expect(codes).toContain('MOA-WF-002');
    const loop = await api.post<{ issues: { code: string }[] }>(`/workflows/${w.id}/validate`, {
      nodes: w.draft.nodes,
      edges: [...w.draft.edges, { source: 'out', source_port: 'result', target: 'rag', target_port: 'query' }],
    });
    expect(loop.issues.map((i) => i.code)).toContain('MOA-WF-001');
  });
  it('버전 저장은 검증 오류가 있으면 422', async () => {
    const created = await api.post<WorkflowDetailRow>('/workflows', { name: '빈 워크플로' });
    const e = await fail(api.post(`/workflows/${created.id}/versions`, { note: 'x' }));
    expect(e.status).toBe(422);
  });
});
