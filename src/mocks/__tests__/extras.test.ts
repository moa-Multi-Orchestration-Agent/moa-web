import { beforeEach, describe, expect, it } from 'vitest';
import type { KbDocument } from '@/entities/credential/api';
import type { BillingInfo } from '@/entities/budget/billing';
import type { Page } from '@/shared/lib/api-client';
import { db } from '../db';
import { WS2 } from '../fixtures';
import { api, fail, fresh, waitFor } from './helpers';

beforeEach(() => fresh());

const otherProduct = () => db.market_products.find((p) => p.status === 'published' && p.seller_name !== 'MOA 팀')!;

describe('마켓 확장', () => {
  it('판매자 팔로우 토글', async () => {
    const name = encodeURIComponent(otherProduct().seller_name);
    const before = await api.get<{ following: boolean; follower_count: number }>(`/market/sellers/${name}`);
    expect(before.following).toBe(false);
    await api.post(`/market/sellers/${name}/follow`, {});
    const after = await api.get<{ following: boolean; follower_count: number }>(`/market/sellers/${name}`);
    expect(after).toMatchObject({ following: true, follower_count: before.follower_count + 1 });
    await api.delete(`/market/sellers/${name}/follow`);
    expect((await api.get<{ following: boolean }>(`/market/sellers/${name}`)).following).toBe(false);
  });

  it('무료 체험은 3회까지, 4번째는 429 MOA-RATE-001', async () => {
    const p = otherProduct();
    for (let i = 0; i < 3; i++) {
      const r = await api.post<{ run: { id: string; trigger: string }; remaining: number }>(`/market/products/${p.id}/trial`, { input: { query: '테스트' } });
      expect(r.remaining).toBe(2 - i);
      expect(r.run.trigger).toBe('market');
    }
    const e = await fail(api.post(`/market/products/${p.id}/trial`, { input: {} }));
    expect([e.status, e.code]).toEqual([429, 'MOA-RATE-001']);
  });

  it('리뷰 답글은 내 상품에만', async () => {
    const mine = db.market_products.find((p) => p.seller_name === 'MOA 팀' && p.status === 'published')!;
    const myReview = db.reviews.find((r) => r.product_id === mine.id)!;
    const r = await api.post<{ reply: { body: string } }>(`/market/reviews/${myReview.id}/reply`, { body: '감사합니다' });
    expect(r.reply.body).toBe('감사합니다');
    const other = db.reviews.find((x) => x.product_id === otherProduct().id)!;
    expect((await fail(api.post(`/market/reviews/${other.id}/reply`, { body: '답글' }))).code).toBe('MOA-AUTH-003');
  });
});

describe('결제 · 정산', () => {
  it('끝 4자리만 남기고 평문은 응답하지 않는다', async () => {
    const r = await api.put<BillingInfo & Record<string, unknown>>('/billing', { card_brand: '현대카드', card_number: '1234 5678 9012 3456', payout_bank: '국민은행', payout_account: '123-456-78901', payout_holder: '모아' });
    expect(r).toMatchObject({ card_last4: '3456', payout_last4: '8901' });
    expect(JSON.stringify(r)).not.toContain('1234567890123456');
    // 번호를 비우고 보내면 기존 끝 4자리를 유지한다
    const r2 = await api.put<BillingInfo>('/billing', { payout_holder: '모아 주식회사' });
    expect(r2).toMatchObject({ card_last4: '3456', payout_holder: '모아 주식회사' });
  });
  it('짧은 카드 번호는 422, 소유자가 아니면 403', async () => {
    expect((await fail(api.put('/billing', { card_number: '1234' }))).status).toBe(422);
    fresh(WS2);
    expect((await fail(api.put('/billing', { payout_holder: 'x' }))).status).toBe(403);
  });
});

describe('지식베이스 문서', () => {
  it('업로드 → 색인 → 준비됨, 이름에 fail이면 실패', async () => {
    const kb = db.knowledge_bases[0]!;
    const ok = await api.post<KbDocument & { upload_url: string }>(`/knowledge-bases/${kb.id}/documents`, { filename: '규정.pdf', mime: 'application/pdf', bytes: 60_000 });
    expect(ok.status).toBe('pending');
    expect(ok.upload_url).toContain('X-Amz-Signature');
    const bad = await api.post<KbDocument>(`/knowledge-bases/${kb.id}/documents`, { filename: 'fail.md', bytes: 100 });
    const docs = () => api.get<Page<KbDocument>>(`/knowledge-bases/${kb.id}/documents`).then((p) => p.items);
    await waitFor(async () => (await docs()).filter((d) => d.id === ok.id || d.id === bad.id).every((d) => d.status === 'ready' || d.status === 'failed'));
    const all = await docs();
    expect(all.find((d) => d.id === ok.id)).toMatchObject({ status: 'ready', chunk_count: 10 });
    expect(all.find((d) => d.id === bad.id)?.status).toBe('failed');
  });
  it('형식·크기 검사와 삭제', async () => {
    const kb = db.knowledge_bases[0]!;
    expect((await fail(api.post(`/knowledge-bases/${kb.id}/documents`, { filename: 'a.exe', bytes: 1 }))).status).toBe(415);
    expect((await fail(api.post(`/knowledge-bases/${kb.id}/documents`, { filename: 'a.pdf', bytes: 30 * 1024 * 1024 }))).status).toBe(413);
    const d = await api.post<KbDocument>(`/knowledge-bases/${kb.id}/documents`, { filename: 'b.txt', bytes: 10 });
    await api.delete(`/knowledge-bases/${kb.id}/documents/${d.id}`);
    expect((await fail(api.delete(`/knowledge-bases/${kb.id}/documents/${d.id}`))).status).toBe(404);
  });
});

describe('연동 확장', () => {
  it('MCP OAuth는 code 없이 401, 있으면 auth=oauth', async () => {
    const e = await fail(api.post('/mcp/servers', { name: 'Linear', transport: 'http', url: 'https://mcp.linear.app/mcp', auth: 'oauth' }));
    expect([e.status, e.code]).toEqual([401, 'MOA-MCP-001']);
    const s = await api.post<{ auth: string }>('/mcp/servers', { name: 'Linear', transport: 'http', url: 'https://mcp.linear.app/mcp', auth: 'oauth', oauth_code: 'mock-1' });
    expect(s.auth).toBe('oauth');
  });
  it('3D 프리셋은 같은 이름이면 덮어쓴다', async () => {
    const n = db.presets_3d.length;
    await api.post('/presets/3d', { name: '내 프리셋', params: { volume: 10 } });
    const p = await api.post<{ params: Record<string, unknown> }>('/presets/3d', { name: '내 프리셋', params: { volume: 90 } });
    expect(p.params.volume).toBe(90);
    expect(db.presets_3d.length).toBe(n + 1);
  });
  it('Slack 연결 · 해제', async () => {
    const ep = db.endpoints[0]!;
    expect(await api.get(`/endpoints/${ep.id}/slack`)).toBeNull();
    expect((await fail(api.put(`/endpoints/${ep.id}/slack`, { team: 'moa', channel: 'no-hash' }))).status).toBe(422);
    await api.put(`/endpoints/${ep.id}/slack`, { team: 'moa', channel: '#cs-bot' });
    expect(await api.get(`/endpoints/${ep.id}/slack`)).toMatchObject({ channel: '#cs-bot' });
    await api.delete(`/endpoints/${ep.id}/slack`);
    expect(await api.get(`/endpoints/${ep.id}/slack`)).toBeNull();
  });
});
