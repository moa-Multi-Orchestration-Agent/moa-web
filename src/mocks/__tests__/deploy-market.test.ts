import { beforeEach, describe, expect, it } from 'vitest';
import type { EndpointRow } from '@/entities/endpoint/model';
import type { AgentRow } from '@/entities/agent/model';
import type { Page } from '@/shared/lib/api-client';
import { apiUrl } from '@/shared/lib/api-client';
import { db } from '../db';
import { api, fail, fresh, waitFor } from './helpers';

beforeEach(() => fresh());

describe('배포', () => {
  it('slug 형식 오류 422, 중복 409 MOA-API-001', async () => {
    const agent = db.agents[1]!;
    expect((await fail(api.post('/endpoints', { agent_id: agent.id, slug: 'A!' }))).code).toBe('MOA-API-005');
    const e = await fail(api.post('/endpoints', { agent_id: agent.id, slug: 'docs-qa' }));
    expect([e.status, e.code]).toEqual([409, 'MOA-API-001']);
    const ok = await api.post<EndpointRow>('/endpoints', { agent_id: agent.id, slug: 'docs-qa-v2', mode: 'sync' });
    expect(ok.input_schema).toMatchObject({ required: ['question'] });
  });
  it('API 키 평문은 발급 응답에만 있다', async () => {
    const k = await api.post<{ key: string; id: string }>('/api-keys', { name: '새 키' });
    expect(k.key).toMatch(/^moa_live_[0-9a-f]{8}_/);
    const list = await api.get<Page<Record<string, unknown>>>('/api-keys');
    const row = list.items.find((x) => x.id === k.id)!;
    expect(row.key).toBeUndefined();
    expect(row.secret).toBeUndefined();
  });
  it('배포 API 호출: 키 검증 → 스키마 검증 → 실행 결과', async () => {
    const k = await api.post<{ key: string }>('/api-keys', { name: '호출용' });
    const call = (b: unknown, key = k.key) => fetch('http://localhost/a/team-moa/docs-qa', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(b) });
    expect((await call({ question: '연차?' }, 'moa_live_bad')).status).toBe(401);
    const bad = await call({ question: '연차?', extra: 1 });
    expect(bad.status).toBe(422);
    expect((await bad.json()).code).toBe('MOA-API-003');
    const ok = await call({ question: '연차?' });
    expect(ok.status).toBe(200);
    const bodyJson = await ok.json();
    expect(bodyJson.status).toBe('succeeded');
    expect(bodyJson.usage.tokens_in).toBeGreaterThan(0);
  });
  it('OpenAPI 문서', async () => {
    const r = await fetch(apiUrl('/').replace('/api/v1/', '') + '/a/team-moa/docs-qa/openapi.json');
    const doc = await r.json();
    expect(doc.openapi).toBe('3.1.0');
  });
});

describe('마켓', () => {
  it('복제 구매하면 스튜디오에 사본이 생기고, 두 번째는 409 MOA-MKT-002', async () => {
    const p = db.market_products.find((x) => x.title === '논문 요약 · 인용 정리')!;
    const before = (await api.get<Page<unknown>>('/workflows', { query: { limit: 100 } })).items.length;
    const r = await api.post<{ clone: { workflow_ids: string[] } }>(`/market/products/${p.id}/purchase`, { license_type: 'clone' });
    expect(r.clone.workflow_ids).toHaveLength(1);
    const after = (await api.get<Page<unknown>>('/workflows', { query: { limit: 100 } })).items.length;
    expect(after).toBe(before + 1);
    const e = await fail(api.post(`/market/products/${p.id}/purchase`, { license_type: 'clone' }));
    expect([e.status, e.code]).toEqual([409, 'MOA-MKT-002']);
  });
  it('API 구독은 라이선스만 생기고 복제본 워크플로는 없다', async () => {
    const p = db.market_products.find((x) => x.title === '법률 문서 조항 검토 에이전트')!;
    const before = db.workflows.length;
    const r = await api.post<{ license: { type: string; expires_at: string } }>(`/market/products/${p.id}/purchase`, { license_type: 'api_sub' });
    expect(r.license.type).toBe('api_sub');
    expect(r.license.expires_at).toBeTruthy();
    expect(db.workflows.length).toBe(before);
    const agents = await api.get<Page<AgentRow>>('/agents', { query: { filter: 'purchased', limit: 50 } });
    expect(agents.items.some((a) => a.name === p.title && a.api_only)).toBe(true);
  });
  it('판매 등록: 비밀값이 있으면 422 MOA-MKT-001', async () => {
    const a = db.agents[0]!;
    a.system_prompt += ' 키: sk-ant-api03-abcdefghijklmnop';
    const e = await fail(api.post('/market/products', { agent_id: a.id, title: '판매', summary: '요약 요약 요약', category: 'research', tags: [], readme_md: '', license_types: ['clone'], price_clone_krw: 1000, price_api_month_krw: null }));
    expect([e.status, e.code]).toEqual([422, 'MOA-MKT-001']);
    expect((e.body?.findings as { severity: string }[]).some((f) => f.severity === 'error')).toBe(true);
  });
  it('템플릿으로 시작하면 에이전트와 워크플로가 생기고 빠진 연결을 알려 준다', async () => {
    const r = await api.post<{ agent_id: string; workflow_id: string; missing: { label: string }[] }>('/templates/tpl-04/instantiate', {});
    expect(r.agent_id).toBeTruthy();
    expect(r.missing).toEqual([]);
    db.mcp_servers.splice(0, db.mcp_servers.length);
    const r2 = await api.post<{ missing: { label: string }[] }>('/templates/tpl-04/instantiate', {});
    expect(r2.missing.map((m) => m.label)).toEqual(['Slack (MCP)']);
    await waitFor(() => true);
  });
});
