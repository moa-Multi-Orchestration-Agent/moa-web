import { http } from 'msw';
import { modelLabel } from '@/entities/agent/model';
import { db } from '../db';
import { API, body, guard, isResponse, json, notFound, problem } from '../lib/http';
import { DAY, uuid } from '../lib/util';

function monthStart() {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function scopeName(type: string, id: string) {
  if (type === 'workspace') return db.workspaces.find((w) => w.id === id)?.name ?? '워크스페이스';
  if (type === 'agent') return db.agents.find((a) => a.id === id)?.name ?? '에이전트';
  return db.endpoints.find((e) => e.id === id)?.slug ?? '엔드포인트';
}

function budgetView(b: (typeof db.budgets)[number]) {
  const since = monthStart();
  const spent = db.usage_ledger
    .filter((l) => l.workspace_id === b.workspace_id && l.created_at >= since && (b.scope_type === 'workspace' || (b.scope_type === 'agent' ? l.agent_id === b.scope_id : l.endpoint_id === b.scope_id)))
    .reduce((s, l) => s + l.cost_usd, 0);
  return { ...b, spent_usd: Number(spent.toFixed(4)), scope_name: scopeName(b.scope_type, b.scope_id) };
}

export const billingHandlers = [
  http.get(`${API}/budgets`, ({ request }) => {
    const ctx = guard(request);
    if (isResponse(ctx)) return ctx;
    return json({ items: db.budgets.filter((b) => b.workspace_id === ctx.wsId).map(budgetView), next_cursor: null });
  }),
  http.put(`${API}/budgets`, async ({ request }) => {
    const ctx = guard(request, 'admin');
    if (isResponse(ctx)) return ctx;
    const b = await body<{ scope_type: 'workspace' | 'agent' | 'endpoint'; scope_id: string; monthly_limit_usd: number | null; per_run_limit_usd: number | null; alert_ratio: number }>(request);
    if (!b.scope_type || !b.scope_id) return problem('MOA-VALIDATION', 'scope_type과 scope_id가 필요합니다.');
    if ((b.monthly_limit_usd ?? 0) < 0 || (b.per_run_limit_usd ?? 0) < 0) return problem('MOA-VALIDATION', '한도는 0 이상이어야 합니다.');
    if (b.alert_ratio < 0 || b.alert_ratio > 1) return problem('MOA-VALIDATION', '알림 비율은 0~1입니다.');
    let row = db.budgets.find((x) => x.workspace_id === ctx.wsId && x.scope_type === b.scope_type && x.scope_id === b.scope_id);
    if (!row) {
      row = { id: uuid(), workspace_id: ctx.wsId, scope_type: b.scope_type, scope_id: b.scope_id, monthly_limit_usd: null, per_run_limit_usd: null, alert_ratio: 0.8 };
      db.budgets.push(row);
    }
    Object.assign(row, { monthly_limit_usd: b.monthly_limit_usd, per_run_limit_usd: b.per_run_limit_usd, alert_ratio: b.alert_ratio });
    return json(budgetView(row));
  }),
  http.delete(`${API}/budgets/:id`, ({ request, params }) => {
    const ctx = guard(request, 'admin');
    if (isResponse(ctx)) return ctx;
    const idx = db.budgets.findIndex((b) => b.id === params.id && b.workspace_id === ctx.wsId && b.scope_type !== 'workspace');
    if (idx < 0) return notFound('예산');
    db.budgets.splice(idx, 1);
    return new Response(null, { status: 204 });
  }),
  // 사용량 대시보드: GET /usage?from&to&group_by=day|model|agent|endpoint
  http.get(`${API}/usage`, ({ request }) => {
    const ctx = guard(request);
    if (isResponse(ctx)) return ctx;
    const sp = new URL(request.url).searchParams;
    const to = sp.get('to') ?? new Date().toISOString();
    const from = sp.get('from') ?? new Date(Date.now() - 30 * DAY).toISOString();
    const groupBy = sp.get('group_by') ?? 'day';
    const rows = db.usage_ledger.filter((l) => l.workspace_id === ctx.wsId && l.created_at >= from && l.created_at <= to);
    const map = new Map<string, { key: string; label: string; cost_usd: number; tokens_in: number; tokens_out: number; runs: Set<string> }>();
    for (const l of rows) {
      const key = groupBy === 'model' ? l.model : groupBy === 'agent' ? (l.agent_id ?? 'none') : groupBy === 'endpoint' ? (l.endpoint_id ?? 'none') : l.created_at.slice(0, 10);
      const label = groupBy === 'model' ? modelLabel(l.model) : groupBy === 'agent' ? (db.agents.find((a) => a.id === l.agent_id)?.name ?? '워크플로 단독 실행') : groupBy === 'endpoint' ? (db.endpoints.find((e) => e.id === l.endpoint_id)?.slug ?? '편집기·예약') : key;
      const g = map.get(key) ?? { key, label, cost_usd: 0, tokens_in: 0, tokens_out: 0, runs: new Set<string>() };
      g.cost_usd += l.cost_usd;
      g.tokens_in += l.tokens_in;
      g.tokens_out += l.tokens_out;
      g.runs.add(l.run_id);
      map.set(key, g);
    }
    if (groupBy === 'day') {
      for (let t = new Date(from).getTime(); t <= new Date(to).getTime(); t += DAY) {
        const key = new Date(t).toISOString().slice(0, 10);
        if (!map.has(key)) map.set(key, { key, label: key, cost_usd: 0, tokens_in: 0, tokens_out: 0, runs: new Set() });
      }
    }
    const items = [...map.values()]
      .map((g) => ({ key: g.key, label: g.label, cost_usd: Number(g.cost_usd.toFixed(4)), tokens_in: g.tokens_in, tokens_out: g.tokens_out, runs: g.runs.size }))
      .sort((a, b) => (groupBy === 'day' ? a.key.localeCompare(b.key) : b.cost_usd - a.cost_usd));
    const total = items.reduce((s, x) => ({ cost_usd: s.cost_usd + x.cost_usd, tokens_in: s.tokens_in + x.tokens_in, tokens_out: s.tokens_out + x.tokens_out, runs: s.runs + x.runs }), { cost_usd: 0, tokens_in: 0, tokens_out: 0, runs: 0 });
    total.cost_usd = Number(total.cost_usd.toFixed(4));
    return json({ from, to, group_by: groupBy, items, total });
  }),
];
