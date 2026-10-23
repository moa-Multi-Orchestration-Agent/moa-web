import { http } from 'msw';
import type { WorkflowDefinition } from '@/entities/workflow/model';
import type { RequiredConnection } from '@/entities/template/model';
import { db, type DbAgent } from '../db';
import { API, body, guard, isResponse, json, notFound } from '../lib/http';
import { nowIso, uuid } from '../lib/util';
import { isConnected, templateView } from '../views';

/** 템플릿·마켓 복제 공용 (design.md 2.4.4 TemplateInstantiator.clone) */
export function cloneBundle(
  wsId: string,
  userId: string,
  bundle: {
    workflows: { name: string; definition: WorkflowDefinition; description?: string | null }[];
    agent?: { name: string; description?: string | null; model?: string; system_prompt?: string; builtin_skills?: string[]; icon?: string } | null;
    requirements: RequiredConnection[];
  },
  opts: { originVersionId?: string | null; originLicenseId?: string | null; nameSuffix?: string } = {},
) {
  const now = nowIso();
  const workflowIds: string[] = [];
  for (const wf of bundle.workflows) {
    const id = uuid();
    const definition = structuredClone(wf.definition);
    // 자격증명 참조 제거 → 구매자가 다시 연결
    for (const n of definition.nodes) delete (n.config as Record<string, unknown>).credential_id;
    db.workflows.push({ id, workspace_id: wsId, name: wf.name, description: wf.description ?? null, draft: definition, draft_version: 1, origin_version_id: opts.originVersionId ?? null, created_by: userId, created_at: now, updated_at: now, deleted_at: null });
    workflowIds.push(id);
  }
  let agentId: string | null = null;
  if (bundle.agent) {
    agentId = uuid();
    const a: DbAgent = {
      id: agentId,
      workspace_id: wsId,
      name: bundle.agent.name + (opts.nameSuffix ?? ''),
      description: bundle.agent.description ?? null,
      model: bundle.agent.model ?? 'claude-sonnet-4',
      fallback_models: [],
      system_prompt: bundle.agent.system_prompt ?? '',
      temperature: 0.7,
      memory_enabled: true,
      primary_workflow_id: workflowIds[0] ?? null,
      created_by: userId,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      icon: bundle.agent.icon ?? '🤖',
      memory_scopes: ['short'],
      origin_license_id: opts.originLicenseId ?? null,
      api_only: false,
    };
    db.agents.push(a);
    workflowIds.forEach((wid, i) => db.agent_workflows.push({ agent_id: agentId!, workflow_id: wid, alias: i === 0 ? 'main' : `workflow_${i + 1}` }));
    for (const s of bundle.agent.builtin_skills ?? []) db.agent_skills.push({ id: uuid(), agent_id: agentId, mcp_tool_id: null, builtin_skill: s, require_approval: s === 'mail_send', config: { enabled: true } });
  }
  const missing = bundle.requirements.filter((r) => !isConnected(wsId, r));
  return { agent_id: agentId, workflow_ids: workflowIds, missing };
}

export const templateHandlers = [
  http.get(`${API}/templates`, ({ request }) => {
    const sp = new URL(request.url).searchParams;
    const q = (sp.get('q') ?? '').trim().toLowerCase();
    const category = sp.get('category');
    const kind = sp.get('kind');
    let items = db.templates.map(templateView);
    if (category) items = items.filter((t) => t.category === category);
    if (kind) items = items.filter((t) => t.kind === kind);
    if (q) items = items.filter((t) => `${t.name} ${t.summary} ${t.skills.join(' ')}`.toLowerCase().includes(q));
    return json({ items, next_cursor: null });
  }),
  http.get(`${API}/templates/:id`, ({ request, params }) => {
    const ctx = guard(request);
    if (isResponse(ctx)) return ctx;
    const t = db.templates.find((x) => x.id === params.id);
    if (!t) return notFound('템플릿');
    return json({ ...templateView(t), description: t.description, definition: t.definition, connections: t.required_connections.map((r) => ({ ...r, connected: isConnected(ctx.wsId, r) })) });
  }),
  http.post(`${API}/templates/:id/instantiate`, async ({ request, params }) => {
    const ctx = guard(request, 'maker');
    if (isResponse(ctx)) return ctx;
    const t = db.templates.find((x) => x.id === params.id);
    if (!t) return notFound('템플릿');
    const b = await body<{ name?: string; description?: string }>(request);
    const name = b.name?.trim() || t.name;
    const res = cloneBundle(
      ctx.wsId,
      ctx.userId,
      {
        workflows: [{ name: t.kind === 'agent' ? `${name} 워크플로` : name, definition: t.definition, description: b.description ?? t.summary }],
        agent: t.kind === 'agent' ? { name, description: b.description ?? t.summary, model: t.model ?? undefined, system_prompt: t.agent?.system_prompt, builtin_skills: t.agent?.builtin_skills, icon: t.icon } : null,
        requirements: t.required_connections,
      },
      {},
    );
    return json({ agent_id: res.agent_id, workflow_id: res.workflow_ids[0], missing: res.missing }, 201);
  }),
];
