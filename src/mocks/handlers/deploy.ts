import { http, HttpResponse } from 'msw';
import { RESERVED_SLUGS, SLUG_RE } from '@/entities/endpoint/model';
import { inputSchemaOf, validateDefinition } from '@/entities/workflow/graph';
import { db, type DbEndpoint } from '../db';
import { API, body, guard, isResponse, json, notFound, problem } from '../lib/http';
import { DAY, hex, nowIso, randomToken, sha256ish, uuid } from '../lib/util';
import { endpointView } from '../views';
import { createRun } from './runs';

function slugProblem(wsId: string, slug: string, exceptId?: string): Response | null {
  if (!SLUG_RE.test(slug) || RESERVED_SLUGS.includes(slug)) return problem('MOA-API-005', RESERVED_SLUGS.includes(slug) ? `"${slug}"은(는) 예약된 이름입니다.` : '소문자·숫자·하이픈 3~63자, 첫 글자는 영문 소문자나 숫자여야 합니다.');
  if (db.endpoints.some((e) => e.workspace_id === wsId && e.slug === slug && e.id !== exceptId)) return problem('MOA-API-001', `"${slug}"은(는) 이미 쓰는 슬러그입니다.`);
  return null;
}

/** 초안을 불변 버전으로 동결(검증 오류가 있으면 거부) */
function freezeVersion(workflowId: string, userId: string) {
  const w = db.workflows.find((x) => x.id === workflowId)!;
  const { issues } = validateDefinition(w.draft);
  const errors = issues.filter((i) => i.severity === 'error');
  if (errors.length) return problem(errors[0]!.code, `워크플로 "${w.name}"에 검증 오류 ${errors.length}건이 있어 배포할 수 없습니다.`, { issues });
  const latest = db.workflow_versions.filter((v) => v.workflow_id === w.id).sort((a, b) => b.version - a.version)[0];
  const hash = sha256ish(JSON.stringify(w.draft));
  if (latest && latest.def_hash === hash) return latest;
  const v = { id: uuid(), workflow_id: w.id, version: (latest?.version ?? 0) + 1, definition: structuredClone(w.draft), def_hash: hash, note: '배포 시 자동 저장', created_by: userId, created_at: nowIso() };
  db.workflow_versions.push(v);
  return v;
}

function openapiFor(e: DbEndpoint) {
  const ws = db.workspaces.find((w) => w.id === e.workspace_id)!;
  const agent = db.agents.find((a) => a.id === e.agent_id);
  return {
    openapi: '3.1.0',
    info: { title: agent?.name ?? e.slug, version: String(db.workflow_versions.find((v) => v.id === e.workflow_version_id)?.version ?? 1), description: agent?.description ?? '' },
    servers: [{ url: 'https://api.moa.dev' }],
    paths: {
      [`/a/${ws.slug}/${e.slug}`]: {
        post: {
          summary: `${agent?.name ?? e.slug} 호출`,
          security: [{ bearer: [] }],
          parameters: [{ name: 'Idempotency-Key', in: 'header', required: false, schema: { type: 'string' } }],
          requestBody: { required: true, content: { 'application/json': { schema: e.input_schema } } },
          responses: {
            '200': { description: '동기 결과', content: { 'application/json': { schema: { type: 'object', properties: { run_id: { type: 'string' }, status: { type: 'string' }, output: { type: 'object' }, usage: { type: 'object' }, latency_ms: { type: 'integer' } } } } } },
            '202': { description: '비동기 접수', content: { 'application/json': { schema: { type: 'object', properties: { job_id: { type: 'string' }, status: { type: 'string' }, status_url: { type: 'string' }, events_url: { type: 'string' } } } } } },
            '401': { description: 'API 키 오류' },
            '422': { description: '입력 스키마 불일치' },
            '429': { description: '호출 한도 초과' },
          },
        },
      },
    },
    components: { securitySchemes: { bearer: { type: 'http', scheme: 'bearer', bearerFormat: 'moa_live_…' } } },
  };
}

/** 입력 검증: 필수·타입·추가 필드 금지(extra=forbid) */
function validateInput(schema: Record<string, unknown>, data: unknown) {
  const errors: { loc: (string | number)[]; msg: string }[] = [];
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return [{ loc: ['body'], msg: 'JSON 객체여야 합니다' }];
  const props = (schema.properties ?? {}) as Record<string, { type?: string }>;
  for (const r of (schema.required as string[]) ?? []) if (!(r in data)) errors.push({ loc: ['body', r], msg: 'Field required' });
  for (const [k, v] of Object.entries(data)) {
    const p = props[k];
    if (!p) {
      errors.push({ loc: ['body', k], msg: 'Extra inputs are not permitted' });
      continue;
    }
    const t = Array.isArray(v) ? 'array' : v === null ? 'null' : typeof v;
    const ok = !p.type || p.type === t || ((p.type === 'integer' || p.type === 'number') && t === 'number');
    if (!ok) errors.push({ loc: ['body', k], msg: `${p.type} 타입이어야 합니다` });
  }
  return errors;
}

const rateWindow = new Map<string, number[]>();

export const deployHandlers = [
  http.get(`${API}/endpoints`, ({ request }) => {
    const ctx = guard(request);
    if (isResponse(ctx)) return ctx;
    const items = db.endpoints.filter((e) => e.workspace_id === ctx.wsId).sort((a, b) => b.created_at.localeCompare(a.created_at)).map((e) => endpointView(e));
    return json({ items, next_cursor: null });
  }),
  http.get(`${API}/endpoints/check-slug`, ({ request }) => {
    const ctx = guard(request);
    if (isResponse(ctx)) return ctx;
    const slug = new URL(request.url).searchParams.get('slug') ?? '';
    if (!SLUG_RE.test(slug)) return json({ available: false, reason: 'format' });
    if (RESERVED_SLUGS.includes(slug)) return json({ available: false, reason: 'reserved' });
    if (db.endpoints.some((e) => e.workspace_id === ctx.wsId && e.slug === slug)) return json({ available: false, reason: 'taken' });
    return json({ available: true, reason: null });
  }),
  http.post(`${API}/endpoints`, async ({ request }) => {
    const ctx = guard(request, 'maker');
    if (isResponse(ctx)) return ctx;
    const b = await body<{ agent_id?: string; slug?: string; mode?: 'sync' | 'async'; webhook_url?: string | null; rate_limit_rpm?: number }>(request);
    const agent = db.agents.find((a) => a.id === b.agent_id && a.workspace_id === ctx.wsId && !a.deleted_at);
    if (!agent) return problem('MOA-VALIDATION', '배포할 에이전트를 고르세요.', { errors: [{ loc: ['body', 'agent_id'], msg: 'Field required' }] });
    if (agent.api_only) return problem('MOA-MKT-003', 'API 전용 라이선스로 구매한 에이전트는 다시 배포할 수 없습니다.');
    const sp = slugProblem(ctx.wsId, b.slug ?? '');
    if (sp) return sp;
    if (!agent.primary_workflow_id) return problem('MOA-WF-004', '에이전트에 연결된 워크플로가 없어 입력 스키마를 만들 수 없습니다.');
    const version = freezeVersion(agent.primary_workflow_id, ctx.userId);
    if (version instanceof Response) return version;
    const now = nowIso();
    const e: DbEndpoint = { id: uuid(), workspace_id: ctx.wsId, slug: b.slug!, agent_id: agent.id, workflow_version_id: version.id, mode: b.mode ?? 'sync', input_schema: inputSchemaOf(version.definition), webhook_url: b.webhook_url || null, webhook_secret: `whsec_${randomToken(32)}`, rate_limit_rpm: b.rate_limit_rpm ?? 60, is_active: true, created_at: now, updated_at: now };
    db.endpoints.push(e);
    return json(endpointView(e, true), 201);
  }),
  http.get(`${API}/endpoints/:id`, ({ request, params }) => {
    const ctx = guard(request);
    if (isResponse(ctx)) return ctx;
    const e = db.endpoints.find((x) => x.id === params.id && x.workspace_id === ctx.wsId);
    return e ? json(endpointView(e, ctx.role !== 'viewer')) : notFound('엔드포인트');
  }),
  http.patch(`${API}/endpoints/:id`, async ({ request, params }) => {
    const ctx = guard(request, 'maker');
    if (isResponse(ctx)) return ctx;
    const e = db.endpoints.find((x) => x.id === params.id && x.workspace_id === ctx.wsId);
    if (!e) return notFound('엔드포인트');
    const b = await body<Partial<DbEndpoint> & { redeploy?: boolean }>(request);
    if (b.slug !== undefined && b.slug !== e.slug) {
      const sp = slugProblem(ctx.wsId, b.slug, e.id);
      if (sp) return sp;
      e.slug = b.slug;
    }
    if (b.mode) e.mode = b.mode;
    if (b.webhook_url !== undefined) e.webhook_url = b.webhook_url || null;
    if (b.rate_limit_rpm !== undefined) e.rate_limit_rpm = b.rate_limit_rpm;
    if (b.is_active !== undefined) e.is_active = b.is_active;
    if (b.redeploy) {
      const agent = db.agents.find((a) => a.id === e.agent_id);
      if (agent?.primary_workflow_id) {
        const v = freezeVersion(agent.primary_workflow_id, ctx.userId);
        if (v instanceof Response) return v;
        e.workflow_version_id = v.id;
        e.input_schema = inputSchemaOf(v.definition);
      }
    }
    e.updated_at = nowIso();
    return json(endpointView(e, true));
  }),
  http.get(`${API}/endpoints/:id/stats`, ({ request, params }) => {
    const ctx = guard(request);
    if (isResponse(ctx)) return ctx;
    const e = db.endpoints.find((x) => x.id === params.id && x.workspace_id === ctx.wsId);
    if (!e) return notFound('엔드포인트');
    const days = Number(new URL(request.url).searchParams.get('days') ?? 7);
    const items = Array.from({ length: days }, (_, i) => {
      const d = new Date(Date.now() - (days - 1 - i) * DAY);
      const key = d.toISOString().slice(0, 10);
      const real = db.runs.filter((r) => r.endpoint_id === e.id && r.created_at.slice(0, 10) === key);
      const calls = real.length + ((e.slug.length * 13 + i * 29) % 60) + 12;
      return { date: key, calls, errors: real.filter((r) => r.status === 'failed').length + ((i * 7) % 3), p50_ms: 1800 + ((i * 331) % 1400) };
    });
    return json({ items });
  }),
  http.get(`${API}/endpoints/:id/webhook-deliveries`, ({ request, params }) => {
    const ctx = guard(request);
    if (isResponse(ctx)) return ctx;
    const items = db.webhook_deliveries.filter((d) => d.endpoint_id === params.id).sort((a, b) => b.created_at.localeCompare(a.created_at));
    return json({ items, next_cursor: null });
  }),
  http.post(`${API}/endpoints/:id/webhook-deliveries/:deliveryId/redeliver`, ({ request, params }) => {
    const ctx = guard(request, 'maker');
    if (isResponse(ctx)) return ctx;
    const d = db.webhook_deliveries.find((x) => x.id === params.deliveryId && x.endpoint_id === params.id);
    if (!d) return notFound('전송 기록');
    const again = { ...d, id: uuid(), status_code: 200, ok: true, attempt: d.attempt + 1, created_at: nowIso() };
    db.webhook_deliveries.push(again);
    return json(again, 201);
  }),
  http.get(`${API}/endpoints/:id/openapi.json`, ({ request, params }) => {
    const ctx = guard(request);
    if (isResponse(ctx)) return ctx;
    const e = db.endpoints.find((x) => x.id === params.id && x.workspace_id === ctx.wsId);
    return e ? json(openapiFor(e)) : notFound('엔드포인트');
  }),

  // ===== API 키 =====
  http.get(`${API}/api-keys`, ({ request }) => {
    const ctx = guard(request);
    if (isResponse(ctx)) return ctx;
    const items = db.api_keys
      .filter((k) => k.workspace_id === ctx.wsId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map(({ secret: _s, ...k }) => k);
    return json({ items, next_cursor: null });
  }),
  http.post(`${API}/api-keys`, async ({ request }) => {
    const ctx = guard(request, 'admin');
    if (isResponse(ctx)) return ctx;
    const b = await body<{ name?: string; expires_at?: string | null; scopes?: string[] }>(request);
    if (!b.name?.trim()) return problem('MOA-VALIDATION', '키 이름을 입력하세요.');
    const prefix = hex(8);
    const secret = randomToken(32);
    const k = { id: uuid(), workspace_id: ctx.wsId, name: b.name.trim(), prefix, secret, scopes: b.scopes ?? ['invoke'], last_used_at: null, expires_at: b.expires_at ?? null, revoked_at: null, created_by: ctx.userId, created_at: nowIso() };
    db.api_keys.push(k);
    const { secret: _s, ...row } = k;
    // 평문 키는 이 응답에서만 한 번 돌려준다(design.md 2.3.3)
    return json({ ...row, key: `moa_live_${prefix}_${secret}` }, 201);
  }),
  http.delete(`${API}/api-keys/:id`, ({ request, params }) => {
    const ctx = guard(request, 'admin');
    if (isResponse(ctx)) return ctx;
    const k = db.api_keys.find((x) => x.id === params.id && x.workspace_id === ctx.wsId);
    if (!k) return notFound('API 키');
    k.revoked_at = k.revoked_at ?? nowIso();
    const { secret: _s, ...row } = k;
    return json(row);
  }),

  // ===== 외부 호출 (design.md 2.3.2) =====
  http.get('*/a/:ws/:slug/openapi.json', ({ params }) => {
    const ws = db.workspaces.find((w) => w.slug === params.ws);
    const e = ws && db.endpoints.find((x) => x.workspace_id === ws.id && x.slug === params.slug);
    return e ? json(openapiFor(e)) : problem('MOA-API-002');
  }),
  http.post('*/a/:ws/:slug', async ({ request, params }) => {
    const auth = request.headers.get('Authorization') ?? '';
    const m = /^Bearer moa_live_([0-9a-f]{8})_([A-Za-z0-9_-]+)$/.exec(auth);
    if (!m) return problem('MOA-AUTH-010', 'Authorization: Bearer moa_live_… 형식이어야 합니다.');
    const key = db.api_keys.find((k) => k.prefix === m[1] && k.secret === m[2]);
    if (!key) return problem('MOA-AUTH-010', 'API 키가 맞지 않습니다.');
    if (key.revoked_at || (key.expires_at && key.expires_at < nowIso())) return problem('MOA-AUTH-011');
    const ws = db.workspaces.find((w) => w.slug === params.ws);
    const e = ws && db.endpoints.find((x) => x.workspace_id === ws.id && x.slug === params.slug && x.is_active);
    if (!ws || !e) return problem('MOA-API-002', `/a/${params.ws}/${params.slug} 엔드포인트가 없거나 꺼져 있습니다.`);
    if (key.workspace_id !== ws.id) return problem('MOA-AUTH-003', '이 워크스페이스의 키가 아닙니다.');
    const rk = `${key.id}:${e.id}`;
    const nowMs = Date.now();
    const win = (rateWindow.get(rk) ?? []).filter((t) => t > nowMs - 60_000);
    if (win.length >= e.rate_limit_rpm) {
      return problem('MOA-RATE-001', `분당 ${e.rate_limit_rpm}회 한도를 넘었습니다.`, {}, 429);
    }
    win.push(nowMs);
    rateWindow.set(rk, win);
    let data: unknown;
    try {
      data = await request.json();
    } catch {
      return problem('MOA-API-003', '본문이 올바른 JSON이 아닙니다.');
    }
    const errors = validateInput(e.input_schema, data);
    if (errors.length) return problem('MOA-API-003', errors.map((x) => `${x.loc.at(-1)}: ${x.msg}`).join(', '), { errors });
    key.last_used_at = nowIso();
    const run = createRun(ws.id, { agent_id: e.agent_id, endpoint_id: e.id, api_key_id: key.id, input: data as Record<string, unknown>, trigger: 'api' });
    if (run instanceof Response) return run;
    const headers = { 'X-Request-Id': `01J${hex(10).toUpperCase()}`, 'X-RateLimit-Limit': String(e.rate_limit_rpm), 'X-RateLimit-Remaining': String(e.rate_limit_rpm - win.length) };
    const async = e.mode === 'async' || new URL(request.url).searchParams.get('async') === 'true';
    if (async) {
      return HttpResponse.json({ job_id: run.id, status: 'queued', status_url: `/a/${ws.slug}/${e.slug}/jobs/${run.id}`, events_url: `/a/${ws.slug}/${e.slug}/jobs/${run.id}/events` }, { status: 202, headers });
    }
    const started = Date.now();
    while (!['succeeded', 'failed', 'canceled', 'waiting_approval'].includes(run.status) && Date.now() - started < 20_000) {
      await new Promise((r) => setTimeout(r, 100));
    }
    if (run.status === 'waiting_approval' || !['succeeded', 'failed', 'canceled'].includes(run.status)) {
      return HttpResponse.json({ job_id: run.id, status: run.status, status_url: `/a/${ws.slug}/${e.slug}/jobs/${run.id}` }, { status: 202, headers });
    }
    return HttpResponse.json(
      { run_id: run.id, status: run.status, output: run.output, error_code: run.error_code, usage: { tokens_in: run.tokens_in, tokens_out: run.tokens_out, cost_usd: run.cost_usd }, latency_ms: Date.now() - started },
      { status: 200, headers },
    );
  }),
  http.get('*/a/:ws/:slug/jobs/:jobId', ({ params }) => {
    const r = db.runs.find((x) => x.id === params.jobId);
    return r ? json({ job_id: r.id, status: r.status, output: r.output, error_code: r.error_code }) : problem('MOA-API-002');
  }),
];
