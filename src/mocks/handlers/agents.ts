import { http } from 'msw';
import { db, type DbAgent } from '../db';
import { API, body, guard, isResponse, json, notFound, paginate, problem } from '../lib/http';
import { nowIso, uuid } from '../lib/util';
import { agentDetailView, agentView } from '../views';

const findAgent = (wsId: string, id: string) => db.agents.find((a) => a.id === id && a.workspace_id === wsId && !a.deleted_at);

export function filterAgents(wsId: string, url: URL) {
  const q = (url.searchParams.get('q') ?? '').trim().toLowerCase();
  const filter = url.searchParams.get('filter') ?? 'all';
  const sort = url.searchParams.get('sort') ?? 'updated';
  let items = db.agents.filter((a) => a.workspace_id === wsId && !a.deleted_at).map(agentView);
  if (q) items = items.filter((a) => a.name.toLowerCase().includes(q) || (a.description ?? '').toLowerCase().includes(q));
  if (filter === 'deployed') items = items.filter((a) => a.endpoint_count > 0);
  if (filter === 'draft') items = items.filter((a) => a.endpoint_count === 0 && !a.purchased);
  if (filter === 'listed') items = items.filter((a) => a.listed);
  if (filter === 'purchased') items = items.filter((a) => a.purchased);
  if (sort === 'name') items.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  else if (sort === 'runs') items.sort((a, b) => b.run_count - a.run_count);
  else items.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  return items;
}

export const agentHandlers = [
  http.get(`${API}/agents`, ({ request }) => {
    const ctx = guard(request);
    if (isResponse(ctx)) return ctx;
    const url = new URL(request.url);
    return json(paginate(filterAgents(ctx.wsId, url), url));
  }),
  http.post(`${API}/agents`, async ({ request }) => {
    const ctx = guard(request, 'maker');
    if (isResponse(ctx)) return ctx;
    const b = await body<Partial<DbAgent>>(request);
    if (!b.name?.trim()) return problem('MOA-VALIDATION', '이름을 입력하세요.', { errors: [{ loc: ['body', 'name'], msg: 'Field required' }] });
    const now = nowIso();
    const a: DbAgent = {
      id: uuid(),
      workspace_id: ctx.wsId,
      name: b.name.trim(),
      description: b.description ?? null,
      model: b.model ?? 'claude-sonnet-4',
      fallback_models: b.fallback_models ?? [],
      system_prompt: b.system_prompt ?? '',
      temperature: b.temperature ?? 0.7,
      memory_enabled: b.memory_enabled ?? true,
      primary_workflow_id: b.primary_workflow_id ?? null,
      created_by: ctx.userId,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      icon: b.icon ?? '🤖',
      memory_scopes: b.memory_scopes ?? ['short'],
      origin_license_id: null,
      api_only: false,
    };
    db.agents.push(a);
    return json(agentDetailView(a), 201);
  }),
  http.get(`${API}/agents/:id`, ({ request, params }) => {
    const ctx = guard(request);
    if (isResponse(ctx)) return ctx;
    const a = findAgent(ctx.wsId, String(params.id));
    return a ? json(agentDetailView(a)) : notFound('에이전트');
  }),
  http.patch(`${API}/agents/:id`, async ({ request, params }) => {
    const ctx = guard(request, 'maker');
    if (isResponse(ctx)) return ctx;
    const a = findAgent(ctx.wsId, String(params.id));
    if (!a) return notFound('에이전트');
    if (a.api_only) return problem('MOA-MKT-003', 'API 전용 라이선스로 구매한 에이전트는 수정할 수 없습니다.');
    const b = await body<Partial<DbAgent>>(request);
    if (b.temperature !== undefined && (b.temperature < 0 || b.temperature > 2)) return problem('MOA-VALIDATION', 'temperature는 0~2 사이입니다.');
    if (b.name !== undefined && !b.name.trim()) return problem('MOA-VALIDATION', '이름을 입력하세요.');
    const allowed: (keyof DbAgent)[] = ['name', 'description', 'model', 'fallback_models', 'system_prompt', 'temperature', 'memory_enabled', 'primary_workflow_id', 'icon', 'memory_scopes'];
    for (const k of allowed) if (b[k] !== undefined) (a as unknown as Record<string, unknown>)[k] = b[k];
    a.updated_at = nowIso();
    return json(agentDetailView(a));
  }),
  http.delete(`${API}/agents/:id`, ({ request, params }) => {
    const ctx = guard(request, 'admin');
    if (isResponse(ctx)) return ctx;
    const a = findAgent(ctx.wsId, String(params.id));
    if (!a) return notFound('에이전트');
    if (db.endpoints.some((e) => e.agent_id === a.id && e.is_active)) return problem('MOA-VALIDATION', '배포 중인 에이전트는 먼저 엔드포인트를 끄세요.', {}, 409);
    a.deleted_at = nowIso();
    return new Response(null, { status: 204 });
  }),
  http.post(`${API}/agents/:id/duplicate`, ({ request, params }) => {
    const ctx = guard(request, 'maker');
    if (isResponse(ctx)) return ctx;
    const a = findAgent(ctx.wsId, String(params.id));
    if (!a) return notFound('에이전트');
    if (a.api_only) return problem('MOA-MKT-003', 'API 전용 라이선스는 복제할 수 없습니다.');
    const now = nowIso();
    const copy: DbAgent = { ...structuredClone(a), id: uuid(), name: `${a.name} (사본)`, created_at: now, updated_at: now, created_by: ctx.userId };
    db.agents.push(copy);
    for (const s of db.agent_skills.filter((x) => x.agent_id === a.id)) db.agent_skills.push({ ...structuredClone(s), id: uuid(), agent_id: copy.id });
    for (const l of db.agent_workflows.filter((x) => x.agent_id === a.id)) db.agent_workflows.push({ ...l, agent_id: copy.id });
    return json(agentDetailView(copy), 201);
  }),
  http.post(`${API}/agents/:id/skills`, async ({ request, params }) => {
    const ctx = guard(request, 'maker');
    if (isResponse(ctx)) return ctx;
    const a = findAgent(ctx.wsId, String(params.id));
    if (!a) return notFound('에이전트');
    const b = await body<{ mcp_tool_id?: string | null; builtin_skill?: string | null; require_approval?: boolean; config?: Record<string, unknown> }>(request);
    if (!b.mcp_tool_id === !b.builtin_skill) return problem('MOA-VALIDATION', 'mcp_tool_id와 builtin_skill 중 하나만 지정하세요.');
    if (b.mcp_tool_id && !db.mcp_tools.some((t) => t.id === b.mcp_tool_id)) return problem('MOA-VALIDATION', '없는 MCP 도구입니다.');
    const dup = db.agent_skills.find((s) => s.agent_id === a.id && ((b.mcp_tool_id && s.mcp_tool_id === b.mcp_tool_id) || (b.builtin_skill && s.builtin_skill === b.builtin_skill)));
    if (dup) return problem('MOA-VALIDATION', '이미 붙은 스킬입니다.', {}, 409);
    const destructive = b.mcp_tool_id ? !!db.mcp_tools.find((t) => t.id === b.mcp_tool_id)?.annotations.destructiveHint : b.builtin_skill === 'mail_send';
    const s = { id: uuid(), agent_id: a.id, mcp_tool_id: b.mcp_tool_id ?? null, builtin_skill: b.builtin_skill ?? null, require_approval: b.require_approval ?? destructive, config: { enabled: true, ...(b.config ?? {}) } };
    db.agent_skills.push(s);
    a.updated_at = nowIso();
    return json(agentDetailView(a), 201);
  }),
  http.patch(`${API}/agents/:id/skills/:skillId`, async ({ request, params }) => {
    const ctx = guard(request, 'maker');
    if (isResponse(ctx)) return ctx;
    const a = findAgent(ctx.wsId, String(params.id));
    const s = db.agent_skills.find((x) => x.id === params.skillId && x.agent_id === a?.id);
    if (!a || !s) return notFound('스킬');
    const b = await body<{ require_approval?: boolean; config?: Record<string, unknown> }>(request);
    if (b.require_approval !== undefined) s.require_approval = b.require_approval;
    if (b.config) s.config = { ...s.config, ...b.config };
    a.updated_at = nowIso();
    return json(agentDetailView(a));
  }),
  http.delete(`${API}/agents/:id/skills/:skillId`, ({ request, params }) => {
    const ctx = guard(request, 'maker');
    if (isResponse(ctx)) return ctx;
    const a = findAgent(ctx.wsId, String(params.id));
    const idx = db.agent_skills.findIndex((x) => x.id === params.skillId && x.agent_id === a?.id);
    if (!a || idx < 0) return notFound('스킬');
    db.agent_skills.splice(idx, 1);
    a.updated_at = nowIso();
    return json(agentDetailView(a));
  }),
  http.put(`${API}/agents/:id/workflows`, async ({ request, params }) => {
    const ctx = guard(request, 'maker');
    if (isResponse(ctx)) return ctx;
    const a = findAgent(ctx.wsId, String(params.id));
    if (!a) return notFound('에이전트');
    const b = await body<{ items: { workflow_id: string; alias: string }[] }>(request);
    const items = b.items ?? [];
    const aliases = new Set<string>();
    for (const it of items) {
      if (!/^[a-z][a-z0-9_]{1,39}$/.test(it.alias)) return problem('MOA-VALIDATION', `별칭 "${it.alias}"은(는) 영문 소문자·숫자·밑줄 2~40자여야 합니다.`, { errors: [{ loc: ['body', 'items', it.workflow_id, 'alias'], msg: 'pattern' }] });
      if (aliases.has(it.alias)) return problem('MOA-VALIDATION', `별칭 "${it.alias}"이(가) 겹칩니다.`, {}, 409);
      aliases.add(it.alias);
      if (!db.workflows.some((w) => w.id === it.workflow_id && w.workspace_id === ctx.wsId && !w.deleted_at)) return notFound('워크플로');
    }
    db.agent_workflows = db.agent_workflows.filter((l) => l.agent_id !== a.id).concat(items.map((it) => ({ agent_id: a.id, ...it })));
    a.primary_workflow_id = items[0]?.workflow_id ?? null;
    a.updated_at = nowIso();
    return json(agentDetailView(a));
  }),
];
