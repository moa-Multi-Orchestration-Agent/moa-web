import { http } from 'msw';
import type { ScanFinding } from '@/entities/product/model';
import { db, type DbProduct } from '../db';
import { API, body, guard, isResponse, json, notFound, paginate, problem } from '../lib/http';
import { DAY, iso, nowIso, uuid } from '../lib/util';
import { agentDetailView, isConnected, productView } from '../views';
import { cloneBundle } from './templates';

const SECRET_RULES: [string, RegExp][] = [
  ['anthropic_key', /sk-ant-[A-Za-z0-9_-]{8,}/],
  ['openai_key', /sk-[A-Za-z0-9]{20,}/],
  ['aws_key', /AKIA[0-9A-Z]{16}/],
  ['jwt', /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/],
  ['pem', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['slack_token', /xox[baprs]-[A-Za-z0-9-]{10,}/],
];
const INTERNAL_HOST = /(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+)/;
const PII = [/01[016789]-?\d{3,4}-?\d{4}/, /[\w.+-]+@[\w-]+\.[\w.]+/];

/** PublishSanitizer.scan (design.md 2.4.3) */
export function scanBundle(defn: unknown): ScanFinding[] {
  const findings: ScanFinding[] = [];
  const walk = (node: unknown, path: string) => {
    if (Array.isArray(node)) return node.forEach((v, i) => walk(v, `${path}[${i}]`));
    if (node && typeof node === 'object') {
      for (const [k, v] of Object.entries(node)) {
        const p = `${path}.${k}`;
        if (['credential_id', 'api_key_id', 'webhook_secret'].includes(k) && v) findings.push({ path: p, rule: 'credential_ref', severity: 'info', excerpt: '자동 제거됨' });
        walk(v, p);
      }
      return;
    }
    if (typeof node === 'string') {
      for (const [rule, rx] of SECRET_RULES) {
        const m = rx.exec(node);
        if (m) findings.push({ path, rule, severity: 'error', excerpt: `${m[0].slice(0, 6)}••••${m[0].slice(-3)}` });
      }
      if (INTERNAL_HOST.test(node)) findings.push({ path, rule: 'internal_url', severity: 'warn', excerpt: node.slice(0, 60) });
      for (const rx of PII) {
        const m = rx.exec(node);
        if (m) findings.push({ path, rule: 'pii', severity: 'info', excerpt: `${m[0].slice(0, 3)}••• (게시본에서 가림)` });
      }
    }
  };
  walk(defn, '$');
  return findings;
}

function bundleOfAgent(agentId: string) {
  const a = db.agents.find((x) => x.id === agentId)!;
  const links = db.agent_workflows.filter((l) => l.agent_id === a.id);
  return {
    agent: { ...a, skills: db.agent_skills.filter((s) => s.agent_id === a.id) },
    workflows: links.map((l) => {
      const w = db.workflows.find((x) => x.id === l.workflow_id)!;
      return { name: w.name, definition: w.draft };
    }),
  };
}

function sortProducts(items: ReturnType<typeof productView>[], sort: string) {
  const price = (p: ReturnType<typeof productView>) => Math.min(p.price_clone_krw ?? Infinity, p.price_api_month_krw ?? Infinity);
  if (sort === 'rating') return items.sort((a, b) => b.rating_avg - a.rating_avg);
  if (sort === 'newest') return items.sort((a, b) => b.created_at.localeCompare(a.created_at));
  if (sort === 'price_asc') return items.sort((a, b) => price(a) - price(b));
  if (sort === 'price_desc') return items.sort((a, b) => price(b) - price(a));
  return items.sort((a, b) => b.install_count - a.install_count);
}

export const marketHandlers = [
  http.get(`${API}/market/products`, ({ request }) => {
    const ctx = guard(request);
    if (isResponse(ctx)) return ctx;
    const url = new URL(request.url);
    const sp = url.searchParams;
    const q = (sp.get('q') ?? '').trim().toLowerCase();
    const category = sp.get('category');
    const kind = sp.get('kind');
    const license = sp.get('license');
    const price = sp.get('price');
    let items = db.market_products.filter((p) => p.status === 'published').map((p) => productView(p, ctx.wsId));
    if (q) items = items.filter((p) => `${p.title} ${p.summary} ${p.tags.join(' ')}`.toLowerCase().includes(q));
    if (category) items = items.filter((p) => p.category === category);
    if (kind) items = items.filter((p) => p.kind === kind);
    if (price === 'free') items = items.filter((p) => p.price_clone_krw === 0);
    if (price === 'paid') items = items.filter((p) => p.price_clone_krw !== 0 || p.license_types.includes('api_sub'));
    if (license === 'clone') items = items.filter((p) => p.license_types.includes('clone') && p.price_clone_krw !== 0);
    if (license === 'free_share') items = items.filter((p) => p.price_clone_krw === 0);
    if (license === 'api_sub') items = items.filter((p) => p.license_types.includes('api_sub'));
    return json(paginate(sortProducts(items, sp.get('sort') ?? 'popular'), url, 24));
  }),
  http.get(`${API}/market/products/:id`, ({ request, params }) => {
    const ctx = guard(request);
    if (isResponse(ctx)) return ctx;
    const p = db.market_products.find((x) => x.id === params.id);
    if (!p || (p.status !== 'published' && p.seller_ws !== ctx.wsId)) return notFound('상품');
    const versions = db.market_versions.filter((v) => v.product_id === p.id).sort((a, b) => b.created_at.localeCompare(a.created_at));
    const latest = versions[0];
    const apiOnly = !p.license_types.includes('clone');
    const reqs = latest?.bundle.requirements ?? [];
    return json({
      ...productView(p, ctx.wsId),
      readme_md: p.readme_md,
      versions: versions.map(({ id, product_id, semver, changelog, created_at }) => ({ id, product_id, semver, changelog, created_at })),
      screenshots: p.screenshots,
      preview: { model: apiOnly ? null : (latest?.bundle.agent.model ?? null), skills: (latest?.bundle.agent.skills as string[] | undefined)?.map((s) => (s === 'web_search' ? '웹 검색' : s)) ?? [], workflows: latest?.bundle.workflows.map((w) => w.name) ?? [], public: !apiOnly },
      requirements: [
        { label: '웹 검색', status: 'builtin' },
        ...reqs.map((r) => ({ label: r.label, status: isConnected(ctx.wsId, r) ? 'connected' : 'missing' })),
        { label: '모델 키', status: p.license_types.includes('api_sub') ? 'seller' : isConnected(ctx.wsId, { kind: 'credential', provider: 'anthropic' }) ? 'connected' : 'missing' },
      ],
      seller: { name: p.seller_name, product_count: db.market_products.filter((x) => x.seller_name === p.seller_name).length, joined_at: iso(Date.now() - 300 * DAY) },
    });
  }),
  http.get(`${API}/market/products/:id/reviews`, ({ request, params }) => {
    const url = new URL(request.url);
    const all = db.reviews.filter((r) => r.product_id === params.id).sort((a, b) => b.created_at.localeCompare(a.created_at));
    const distribution: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
    for (const r of all) distribution[String(r.rating)] = (distribution[String(r.rating)] ?? 0) + 1;
    return json({ ...paginate(all, url, 10), distribution });
  }),
  http.post(`${API}/market/products/:id/purchase`, async ({ request, params }) => {
    const ctx = guard(request, 'admin');
    if (isResponse(ctx)) return ctx;
    const p = db.market_products.find((x) => x.id === params.id && x.status === 'published');
    if (!p) return notFound('상품');
    const b = await body<{ license_type: 'clone' | 'api_sub' }>(request);
    if (!p.license_types.includes(b.license_type)) return problem('MOA-MKT-003');
    if (p.seller_ws === ctx.wsId) return problem('MOA-MKT-003', '내 상품은 구매할 수 없습니다.');
    if (b.license_type === 'clone' && db.licenses.some((l) => l.buyer_ws === ctx.wsId && l.product_id === p.id && l.type === 'clone' && !l.revoked_at)) return problem('MOA-MKT-002');
    const version = db.market_versions.filter((v) => v.product_id === p.id).sort((a, b2) => b2.created_at.localeCompare(a.created_at))[0]!;
    const amount = (b.license_type === 'clone' ? p.price_clone_krw : p.price_api_month_krw) ?? 0;
    const now = nowIso();
    const purchase = { id: uuid(), product_id: p.id, version_id: version.id, buyer_ws: ctx.wsId, buyer_user: ctx.userId, license_type: b.license_type, amount_krw: amount, fee_krw: Math.round(amount * 0.2), status: 'paid' as const, pg_tx_id: `mock_${uuid().slice(0, 8)}`, created_at: now, paid_at: now };
    db.purchases.push(purchase);
    const license = { id: uuid(), product_id: p.id, version_id: version.id, buyer_ws: ctx.wsId, purchase_id: purchase.id, type: b.license_type, expires_at: b.license_type === 'clone' ? null : iso(Date.now() + 30 * DAY), revoked_at: null, created_at: now };
    db.licenses.push(license);
    p.install_count += 1;
    const ws = db.workspaces.find((w) => w.id === ctx.wsId)!;
    if (b.license_type === 'clone') {
      const bundleAgent = version.bundle.agent;
      const res = cloneBundle(ctx.wsId, ctx.userId, {
        workflows: version.bundle.workflows,
        agent: p.kind === 'agent' ? { name: p.title, description: p.summary, model: bundleAgent.model, system_prompt: bundleAgent.system_prompt, builtin_skills: (bundleAgent.skills as string[] | undefined) ?? [], icon: p.icon } : null,
        requirements: version.bundle.requirements,
      }, { originLicenseId: license.id, nameSuffix: '' });
      if (res.agent_id) db.agents.find((a) => a.id === res.agent_id)!.origin_license_id = license.id;
      return json({ license, purchase, clone: { agent_id: res.agent_id, workflow_ids: res.workflow_ids, missing: res.missing } }, 201);
    }
    // api_sub: 스튜디오에 API 전용 에이전트 항목 추가
    db.agents.push({ id: uuid(), workspace_id: ctx.wsId, name: p.title, description: `${p.seller_name} 제공 · API 전용`, model: 'claude-sonnet-4', fallback_models: [], system_prompt: '', temperature: 0.7, memory_enabled: false, primary_workflow_id: null, created_by: ctx.userId, created_at: now, updated_at: now, deleted_at: null, icon: p.icon, memory_scopes: [], origin_license_id: license.id, api_only: true });
    return json({ license, purchase, api: { endpoint_url: `https://api.moa.dev/a/${p.seller_name.toLowerCase().replace(/\s/g, '')}/${p.id.slice(-6)}`, expires_at: license.expires_at, workspace: ws.slug } }, 201);
  }),
  http.post(`${API}/market/scan`, async ({ request }) => {
    const ctx = guard(request);
    if (isResponse(ctx)) return ctx;
    const b = await body<{ agent_id: string; readme_md?: string; extra?: unknown }>(request);
    const a = db.agents.find((x) => x.id === b.agent_id && x.workspace_id === ctx.wsId);
    if (!a) return notFound('에이전트');
    const findings = scanBundle({ ...bundleOfAgent(a.id), readme_md: b.readme_md ?? '', extra: b.extra ?? null });
    if (!findings.some((f) => f.rule === 'credential_ref')) findings.unshift({ path: '$.workflows[*].nodes[*].config.credential_id', rule: 'credential_ref', severity: 'info', excerpt: '자격증명 참조 자동 제거' });
    return json({ findings, summary: agentDetailView(a) });
  }),
  http.post(`${API}/market/products`, async ({ request }) => {
    const ctx = guard(request, 'admin');
    if (isResponse(ctx)) return ctx;
    const b = await body<{ agent_id: string; title: string; summary: string; category: string; tags: string[]; readme_md: string; license_types: ('clone' | 'api_sub')[]; price_clone_krw: number | null; price_api_month_krw: number | null }>(request);
    const a = db.agents.find((x) => x.id === b.agent_id && x.workspace_id === ctx.wsId && !x.deleted_at);
    if (!a) return notFound('에이전트');
    if (!b.license_types?.length) return problem('MOA-VALIDATION', '라이선스를 하나 이상 고르세요.');
    if (b.license_types.includes('api_sub') && !db.endpoints.some((e) => e.agent_id === a.id && e.is_active)) return problem('MOA-VALIDATION', 'API 구독 판매는 배포된 엔드포인트가 있어야 합니다. 먼저 배포하세요.', {}, 422);
    const findings = scanBundle({ ...bundleOfAgent(a.id), readme_md: b.readme_md });
    if (findings.some((f) => f.severity === 'error')) return problem('MOA-MKT-001', `비밀값으로 보이는 문자열 ${findings.filter((f) => f.severity === 'error').length}건이 있어 등록할 수 없습니다.`, { findings });
    const now = nowIso();
    const ws = db.workspaces.find((w) => w.id === ctx.wsId)!;
    const p: DbProduct = { id: uuid(), seller_ws: ctx.wsId, agent_id: a.id, endpoint_id: db.endpoints.find((e) => e.agent_id === a.id)?.id ?? null, title: b.title, summary: b.summary, category: b.category, tags: b.tags ?? [], readme_md: b.readme_md, license_types: b.license_types, price_clone_krw: b.price_clone_krw, price_api_month_krw: b.price_api_month_krw, status: 'in_review', rating_avg: 0, rating_count: 0, install_count: 0, created_at: now, updated_at: now, kind: 'agent', icon: a.icon ?? '🤖', seller_name: ws.name, screenshots: [] };
    db.market_products.push(p);
    const bundle = bundleOfAgent(a.id);
    db.market_versions.push({ id: uuid(), product_id: p.id, semver: '1.0.0', bundle: { agent: { name: a.name, model: a.model, system_prompt: a.system_prompt, skills: bundle.agent.skills.map((s) => s.builtin_skill ?? 'mcp') }, workflows: bundle.workflows, requirements: [] }, scan_report: { findings }, workflow_version_id: null, changelog: '첫 공개', created_at: now });
    return json({ ...productView(p, ctx.wsId), findings }, 201);
  }),
  http.get(`${API}/market/my-products`, ({ request }) => {
    const ctx = guard(request);
    if (isResponse(ctx)) return ctx;
    const items = db.market_products
      .filter((p) => p.seller_ws === ctx.wsId)
      .map((p) => {
        const revenue = db.purchases.filter((x) => x.product_id === p.id && x.status === 'paid').reduce((s, x) => s + x.amount_krw, 0) + (p.status === 'published' ? p.install_count * Math.min(p.price_clone_krw ?? 0, p.price_api_month_krw ?? Infinity) * 0.1 : 0);
        return { ...productView(p, ctx.wsId), revenue_krw: Math.round(revenue), reject_reason: p.reject_reason ?? null };
      });
    return json({ items, next_cursor: null });
  }),
  http.get(`${API}/market/sales-stats`, ({ request }) => {
    const ctx = guard(request);
    if (isResponse(ctx)) return ctx;
    const days = Number(new URL(request.url).searchParams.get('days') ?? 30);
    const mine = db.market_products.filter((p) => p.seller_ws === ctx.wsId);
    const ids = new Set(mine.map((p) => p.id));
    const series = Array.from({ length: days }, (_, i) => {
      const d = new Date(Date.now() - (days - 1 - i) * DAY).toISOString().slice(0, 10);
      const installs = mine.length ? ((i * 7 + 3) % 5) + (i % 3) : 0;
      return { date: d, installs, revenue_krw: installs * 29000 };
    });
    const reviews = db.reviews.filter((r) => ids.has(r.product_id)).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5);
    const published = mine.filter((p) => p.status === 'published');
    return json({
      month_revenue_krw: series.slice(-30).reduce((s, x) => s + x.revenue_krw, 0),
      new_installs: series.slice(-30).reduce((s, x) => s + x.installs, 0),
      rating_avg: published.length ? Number((published.reduce((s, p) => s + p.rating_avg, 0) / published.length).toFixed(1)) : 0,
      next_payout_krw: Math.round(series.slice(-30).reduce((s, x) => s + x.revenue_krw, 0) * 0.8),
      series,
      recent_reviews: reviews,
    });
  }),
  http.get(`${API}/licenses`, ({ request }) => {
    const ctx = guard(request);
    if (isResponse(ctx)) return ctx;
    const items = db.licenses
      .filter((l) => l.buyer_ws === ctx.wsId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((l) => {
        const p = db.market_products.find((x) => x.id === l.product_id)!;
        const pur = db.purchases.find((x) => x.id === l.purchase_id);
        return { ...l, product_title: p.title, product_kind: p.kind, amount_krw: pur?.amount_krw ?? 0, semver: db.market_versions.find((v) => v.id === l.version_id)?.semver ?? '1.0.0', reviewed: db.reviews.some((r) => r.license_id === l.id) };
      });
    return json({ items, next_cursor: null });
  }),
  http.post(`${API}/licenses/:id/review`, async ({ request, params }) => {
    const ctx = guard(request);
    if (isResponse(ctx)) return ctx;
    const l = db.licenses.find((x) => x.id === params.id && x.buyer_ws === ctx.wsId);
    if (!l) return notFound('라이선스');
    if (db.reviews.some((r) => r.license_id === l.id)) return problem('MOA-VALIDATION', '이미 리뷰를 썼습니다. 라이선스당 1건입니다.', {}, 409);
    const b = await body<{ rating: number; body?: string }>(request);
    if (!(b.rating >= 1 && b.rating <= 5)) return problem('MOA-VALIDATION', '별점은 1~5입니다.');
    const u = db.users.find((x) => x.id === ctx.userId)!;
    const r = { id: uuid(), product_id: l.product_id, license_id: l.id, author: ctx.userId, author_name: u.display_name, rating: b.rating, body: b.body ?? null, created_at: nowIso() };
    db.reviews.push(r);
    const p = db.market_products.find((x) => x.id === l.product_id)!;
    const all = db.reviews.filter((x) => x.product_id === p.id);
    p.rating_count = all.length;
    p.rating_avg = Number((all.reduce((s, x) => s + x.rating, 0) / all.length).toFixed(1));
    return json(r, 201);
  }),
];
