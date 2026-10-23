/**
 * 설계서 2.6.2 밖, 1차 범위 밖으로 남겨 둔 기능의 목 API (frontend-plan 5절에 추가).
 * 팔로우 · 무료 체험 · 리뷰 답글 · 결제/정산 정보 · 지식베이스 문서 · 3D 프리셋 · Slack 연결
 */
import { http } from 'msw';
import { db } from '../db';
import { API, body, guard, isResponse, json, notFound, problem } from '../lib/http';
import { nowIso, uuid } from '../lib/util';
import { runView } from '../views';
import { createRun } from './runs';

const TRIAL_LIMIT = 3;

function kbView(k: (typeof db.knowledge_bases)[number]) {
  const docs = db.kb_documents.filter((d) => d.kb_id === k.id);
  return { ...k, doc_count: docs.length, ready_count: docs.filter((d) => d.status === 'ready').length, failed_count: docs.filter((d) => d.status === 'failed').length };
}

/** 업로드한 문서를 pending → indexing → ready(또는 failed)로 진행시킨다 */
function progressDoc(id: string) {
  const fast = typeof process !== 'undefined' && process.env?.MOCK_DELAY === 'off';
  const step = (ms: number, fn: () => void) => setTimeout(fn, fast ? 0 : ms);
  step(800, () => {
    const d = db.kb_documents.find((x) => x.id === id);
    if (!d) return;
    d.status = 'indexing';
    step(2500, () => {
      if (/fail|손상/.test(d.filename)) Object.assign(d, { status: 'failed', error: '텍스트를 추출하지 못했습니다(암호 걸린 파일이거나 손상됨).' });
      else Object.assign(d, { status: 'ready', chunk_count: Math.max(1, Math.round(d.bytes / 6000)) });
    });
  });
}

export const extraHandlers = [
  // ===== 판매자 팔로우 =====
  http.get(`${API}/market/sellers/:name`, ({ request, params }) => {
    const ctx = guard(request);
    if (isResponse(ctx)) return ctx;
    const name = decodeURIComponent(String(params.name));
    const products = db.market_products.filter((p) => p.seller_name === name && p.status === 'published');
    if (!products.length) return notFound('판매자');
    return json({ name, product_count: products.length, follower_count: 120 + name.length * 7 + db.follows.filter((f) => f.seller_name === name).length, following: db.follows.some((f) => f.workspace_id === ctx.wsId && f.seller_name === name) });
  }),
  http.post(`${API}/market/sellers/:name/follow`, ({ request, params }) => {
    const ctx = guard(request);
    if (isResponse(ctx)) return ctx;
    const name = decodeURIComponent(String(params.name));
    if (!db.follows.some((f) => f.workspace_id === ctx.wsId && f.seller_name === name)) db.follows.push({ workspace_id: ctx.wsId, seller_name: name });
    return json({ following: true });
  }),
  http.delete(`${API}/market/sellers/:name/follow`, ({ request, params }) => {
    const ctx = guard(request);
    if (isResponse(ctx)) return ctx;
    const name = decodeURIComponent(String(params.name));
    db.follows = db.follows.filter((f) => !(f.workspace_id === ctx.wsId && f.seller_name === name));
    return json({ following: false });
  }),

  // ===== 무료 체험 3회 =====
  http.get(`${API}/market/products/:id/trial`, ({ request, params }) => {
    const ctx = guard(request);
    if (isResponse(ctx)) return ctx;
    const used = db.trials.filter((t) => t.workspace_id === ctx.wsId && t.product_id === params.id).length;
    return json({ limit: TRIAL_LIMIT, used, remaining: Math.max(0, TRIAL_LIMIT - used) });
  }),
  http.post(`${API}/market/products/:id/trial`, async ({ request, params }) => {
    const ctx = guard(request, 'maker');
    if (isResponse(ctx)) return ctx;
    const p = db.market_products.find((x) => x.id === params.id && x.status === 'published');
    if (!p) return notFound('상품');
    const used = db.trials.filter((t) => t.workspace_id === ctx.wsId && t.product_id === p.id).length;
    if (used >= TRIAL_LIMIT) return problem('MOA-RATE-001', `무료 체험 ${TRIAL_LIMIT}회를 모두 썼습니다. 구매하면 계속 쓸 수 있어요.`, {}, 429);
    const version = db.market_versions.filter((v) => v.product_id === p.id).sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    const definition = version?.bundle.workflows[0]?.definition;
    if (!definition) return problem('MOA-VALIDATION', '체험할 수 있는 구성이 없습니다.');
    const b = await body<{ input?: Record<string, unknown> }>(request);
    const run = createRun(ctx.wsId, { definition, input: b.input ?? {}, trigger: 'market', label: `${p.title} (무료 체험)` });
    if (run instanceof Response) return run;
    db.trials.push({ workspace_id: ctx.wsId, product_id: p.id, run_id: run.id, created_at: nowIso() });
    return json({ run: runView(run), remaining: TRIAL_LIMIT - used - 1 }, 201);
  }),

  // ===== 리뷰 답글(판매자) =====
  http.post(`${API}/market/reviews/:id/reply`, async ({ request, params }) => {
    const ctx = guard(request, 'admin');
    if (isResponse(ctx)) return ctx;
    const r = db.reviews.find((x) => x.id === params.id);
    const p = r && db.market_products.find((x) => x.id === r.product_id);
    if (!r || !p) return notFound('리뷰');
    if (p.seller_ws !== ctx.wsId) return problem('MOA-AUTH-003', '내 상품의 리뷰에만 답글을 달 수 있습니다.');
    const b = await body<{ body?: string }>(request);
    if (!b.body?.trim()) return problem('MOA-VALIDATION', '답글 내용을 입력하세요.');
    r.reply = { body: b.body.trim().slice(0, 1000), created_at: nowIso() };
    return json(r);
  }),

  // ===== 결제·정산 정보 =====
  http.get(`${API}/billing`, ({ request }) => {
    const ctx = guard(request);
    if (isResponse(ctx)) return ctx;
    return json(db.billing[ctx.wsId] ?? null);
  }),
  http.put(`${API}/billing`, async ({ request }) => {
    const ctx = guard(request, 'owner');
    if (isResponse(ctx)) return ctx;
    const b = await body<{ card_number?: string; card_brand?: string; payout_bank?: string; payout_account?: string; payout_holder?: string }>(request);
    const cur = db.billing[ctx.wsId] ?? { card_brand: '', card_last4: '', payout_bank: '', payout_last4: '', payout_holder: '', updated_at: nowIso() };
    const card = (b.card_number ?? '').replace(/\D/g, '');
    if (b.card_number !== undefined && (card.length < 12 || card.length > 19)) return problem('MOA-VALIDATION', '카드 번호는 12~19자리 숫자입니다.', { errors: [{ loc: ['body', 'card_number'], msg: 'invalid' }] });
    const acct = (b.payout_account ?? '').replace(/\D/g, '');
    if (b.payout_account !== undefined && acct.length < 8) return problem('MOA-VALIDATION', '계좌 번호를 확인하세요.', { errors: [{ loc: ['body', 'payout_account'], msg: 'invalid' }] });
    const next = {
      card_brand: b.card_brand ?? cur.card_brand,
      card_last4: card ? card.slice(-4) : cur.card_last4,
      payout_bank: b.payout_bank ?? cur.payout_bank,
      payout_last4: acct ? acct.slice(-4) : cur.payout_last4,
      payout_holder: b.payout_holder ?? cur.payout_holder,
      updated_at: nowIso(),
    };
    db.billing[ctx.wsId] = next;
    // 평문 번호는 저장·응답하지 않는다
    return json(next);
  }),

  // ===== 지식베이스 문서 =====
  http.get(`${API}/knowledge-bases/:id/documents`, ({ request, params }) => {
    const ctx = guard(request);
    if (isResponse(ctx)) return ctx;
    const k = db.knowledge_bases.find((x) => x.id === params.id && x.workspace_id === ctx.wsId);
    if (!k) return notFound('지식베이스');
    return json({ items: db.kb_documents.filter((d) => d.kb_id === k.id).sort((a, b) => b.created_at.localeCompare(a.created_at)), next_cursor: null });
  }),
  http.post(`${API}/knowledge-bases/:id/documents`, async ({ request, params }) => {
    const ctx = guard(request, 'maker');
    if (isResponse(ctx)) return ctx;
    const k = db.knowledge_bases.find((x) => x.id === params.id && x.workspace_id === ctx.wsId);
    if (!k) return notFound('지식베이스');
    const b = await body<{ filename?: string; mime?: string; bytes?: number }>(request);
    if (!b.filename) return problem('MOA-VALIDATION', '파일 이름이 없습니다.');
    if ((b.bytes ?? 0) > 20 * 1024 * 1024) return problem('MOA-VALIDATION', '파일은 20MB 이하만 올릴 수 있습니다.', {}, 413);
    if (!/\.(pdf|md|txt|docx|html)$/i.test(b.filename)) return problem('MOA-VALIDATION', 'PDF·MD·TXT·DOCX·HTML만 올릴 수 있습니다.', {}, 415);
    const d = { id: uuid(), kb_id: k.id, filename: b.filename, mime: b.mime ?? 'application/octet-stream', bytes: b.bytes ?? 0, status: 'pending' as const, chunk_count: 0, error: null, created_at: nowIso() };
    db.kb_documents.push(d);
    progressDoc(d.id);
    // 실제로는 사전 서명 URL을 받아 S3에 직접 올린다(design.md EI-05)
    return json({ ...d, upload_url: `https://s3.moa.dev/upload/${d.id}?X-Amz-Signature=mock` }, 201);
  }),
  http.delete(`${API}/knowledge-bases/:id/documents/:docId`, ({ request, params }) => {
    const ctx = guard(request, 'maker');
    if (isResponse(ctx)) return ctx;
    const before = db.kb_documents.length;
    db.kb_documents = db.kb_documents.filter((d) => !(d.id === params.docId && d.kb_id === params.id));
    return before === db.kb_documents.length ? notFound('문서') : new Response(null, { status: 204 });
  }),

  // ===== 3D 프리셋 =====
  http.get(`${API}/presets/3d`, ({ request }) => {
    const ctx = guard(request);
    if (isResponse(ctx)) return ctx;
    return json({ items: db.presets_3d.filter((p) => p.workspace_id === ctx.wsId).sort((a, b) => b.created_at.localeCompare(a.created_at)), next_cursor: null });
  }),
  http.post(`${API}/presets/3d`, async ({ request }) => {
    const ctx = guard(request, 'maker');
    if (isResponse(ctx)) return ctx;
    const b = await body<{ name?: string; params?: Record<string, unknown> }>(request);
    if (!b.name?.trim()) return problem('MOA-VALIDATION', '프리셋 이름을 입력하세요.');
    const existing = db.presets_3d.find((p) => p.workspace_id === ctx.wsId && p.name === b.name!.trim());
    if (existing) {
      existing.params = b.params ?? {};
      return json(existing);
    }
    const p = { id: uuid(), workspace_id: ctx.wsId, name: b.name.trim(), params: b.params ?? {}, created_at: nowIso() };
    db.presets_3d.push(p);
    return json(p, 201);
  }),

  // ===== Slack 봇 연결 =====
  http.get(`${API}/endpoints/:id/slack`, ({ request, params }) => {
    const ctx = guard(request);
    if (isResponse(ctx)) return ctx;
    return json(db.slack_links.find((l) => l.endpoint_id === params.id) ?? null);
  }),
  http.put(`${API}/endpoints/:id/slack`, async ({ request, params }) => {
    const ctx = guard(request, 'admin');
    if (isResponse(ctx)) return ctx;
    const e = db.endpoints.find((x) => x.id === params.id && x.workspace_id === ctx.wsId);
    if (!e) return notFound('엔드포인트');
    const b = await body<{ team?: string; channel?: string }>(request);
    if (!b.team?.trim() || !/^#[\w가-힣-]+$/.test(b.channel ?? '')) return problem('MOA-VALIDATION', '워크스페이스 이름과 #채널을 입력하세요.');
    db.slack_links = db.slack_links.filter((l) => l.endpoint_id !== e.id).concat({ endpoint_id: e.id, team: b.team.trim(), channel: b.channel!, connected_at: nowIso() });
    return json(db.slack_links.at(-1));
  }),
  http.delete(`${API}/endpoints/:id/slack`, ({ request, params }) => {
    const ctx = guard(request, 'admin');
    if (isResponse(ctx)) return ctx;
    db.slack_links = db.slack_links.filter((l) => l.endpoint_id !== params.id);
    return new Response(null, { status: 204 });
  }),
];

export { kbView };
