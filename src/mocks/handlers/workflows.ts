import { http } from 'msw';
import type { WorkflowDefinition } from '@/entities/workflow/model';
import { validateDefinition } from '@/entities/workflow/graph';
import { db, type DbWorkflow } from '../db';
import { BLOCK_GROUPS, BLOCKS } from '../fixtures/blocks';
import { API, body, guard, ifMatch, isResponse, json, notFound, paginate, problem } from '../lib/http';
import { nowIso, sha256ish, uuid } from '../lib/util';
import { workflowDetailView, workflowView } from '../views';

const findWf = (wsId: string, id: string) => db.workflows.find((w) => w.id === id && w.workspace_id === wsId && !w.deleted_at);

const EMPTY_DRAFT = (): WorkflowDefinition => {
  const input = BLOCKS.find((b) => b.id === 'input.manual')!;
  const output = BLOCKS.find((b) => b.id === 'output.result')!;
  return {
    nodes: [
      { id: 'in', type: 'input', block: input.id, name: input.label, config: structuredClone(input.config), ports_in: [], ports_out: [{ name: 'text', type: 'string', label: 'text' }], position: { x: 80, y: 160 } },
      { id: 'out', type: 'output', block: output.id, name: output.label, config: {}, ports_in: output.ports_in, ports_out: [], position: { x: 520, y: 160 } },
    ],
    edges: [],
  };
};

export function filterWorkflows(wsId: string, url: URL) {
  const q = (url.searchParams.get('q') ?? '').trim().toLowerCase();
  const filter = url.searchParams.get('filter') ?? 'all';
  const trigger = url.searchParams.get('trigger');
  const sort = url.searchParams.get('sort') ?? 'updated';
  let items = db.workflows.filter((w) => w.workspace_id === wsId && !w.deleted_at).map(workflowView);
  if (q) items = items.filter((w) => w.name.toLowerCase().includes(q) || (w.description ?? '').toLowerCase().includes(q));
  if (filter === 'deployed') items = items.filter((w) => w.deployed);
  if (filter === 'draft') items = items.filter((w) => !w.deployed && !w.listed);
  if (filter === 'listed') items = items.filter((w) => w.listed);
  if (filter === 'linked') items = items.filter((w) => w.agents.length > 0);
  if (trigger) items = items.filter((w) => w.trigger === trigger);
  if (sort === 'name') items.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  else if (sort === 'runs') items.sort((a, b) => b.run_count - a.run_count);
  else items.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  return items;
}

function duplicateWorkflow(w: DbWorkflow, userId: string, name?: string) {
  const now = nowIso();
  const copy: DbWorkflow = { ...structuredClone(w), id: uuid(), name: name ?? `${w.name} (사본)`, draft_version: 1, created_at: now, updated_at: now, created_by: userId, deleted_at: null };
  db.workflows.push(copy);
  return copy;
}

export const workflowHandlers = [
  http.get(`${API}/node-catalog`, ({ request }) => {
    const ctx = guard(request);
    if (isResponse(ctx)) return ctx;
    return json({ groups: BLOCK_GROUPS, blocks: BLOCKS });
  }),
  http.get(`${API}/workflows`, ({ request }) => {
    const ctx = guard(request);
    if (isResponse(ctx)) return ctx;
    const url = new URL(request.url);
    return json(paginate(filterWorkflows(ctx.wsId, url), url));
  }),
  http.post(`${API}/workflows`, async ({ request }) => {
    const ctx = guard(request, 'maker');
    if (isResponse(ctx)) return ctx;
    const b = await body<{ name?: string; description?: string; draft?: WorkflowDefinition }>(request);
    if (!b.name?.trim()) return problem('MOA-VALIDATION', '이름을 입력하세요.', { errors: [{ loc: ['body', 'name'], msg: 'Field required' }] });
    const now = nowIso();
    const w: DbWorkflow = { id: uuid(), workspace_id: ctx.wsId, name: b.name.trim(), description: b.description ?? null, draft: b.draft ?? EMPTY_DRAFT(), draft_version: 1, origin_version_id: null, created_by: ctx.userId, created_at: now, updated_at: now, deleted_at: null };
    db.workflows.push(w);
    return json(workflowDetailView(w), 201);
  }),
  http.get(`${API}/workflows/:id`, ({ request, params }) => {
    const ctx = guard(request);
    if (isResponse(ctx)) return ctx;
    const w = findWf(ctx.wsId, String(params.id));
    return w ? json(workflowDetailView(w)) : notFound('워크플로');
  }),
  http.patch(`${API}/workflows/:id`, async ({ request, params }) => {
    const ctx = guard(request, 'maker');
    if (isResponse(ctx)) return ctx;
    const w = findWf(ctx.wsId, String(params.id));
    if (!w) return notFound('워크플로');
    const b = await body<{ name?: string; description?: string | null }>(request);
    if (b.name !== undefined) {
      if (!b.name.trim()) return problem('MOA-VALIDATION', '이름을 입력하세요.');
      w.name = b.name.trim();
    }
    if (b.description !== undefined) w.description = b.description;
    w.updated_at = nowIso();
    return json(workflowDetailView(w));
  }),
  http.delete(`${API}/workflows/:id`, ({ request, params }) => {
    const ctx = guard(request, 'admin');
    if (isResponse(ctx)) return ctx;
    const w = findWf(ctx.wsId, String(params.id));
    if (!w) return notFound('워크플로');
    w.deleted_at = nowIso();
    db.agent_workflows = db.agent_workflows.filter((l) => l.workflow_id !== w.id);
    for (const a of db.agents) if (a.primary_workflow_id === w.id) a.primary_workflow_id = null;
    return new Response(null, { status: 204 });
  }),
  http.post(`${API}/workflows/:id/duplicate`, ({ request, params }) => {
    const ctx = guard(request, 'maker');
    if (isResponse(ctx)) return ctx;
    const w = findWf(ctx.wsId, String(params.id));
    if (!w) return notFound('워크플로');
    return json(workflowDetailView(duplicateWorkflow(w, ctx.userId)), 201);
  }),
  // 초안 저장 (design.md 2.6.4): If-Match = draft_version. 검증 오류가 있어도 저장은 성공.
  http.put(`${API}/workflows/:id/draft`, async ({ request, params }) => {
    const ctx = guard(request, 'maker');
    if (isResponse(ctx)) return ctx;
    const w = findWf(ctx.wsId, String(params.id));
    if (!w) return notFound('워크플로');
    const expected = ifMatch(request);
    if (expected === null) return problem('MOA-VALIDATION', 'If-Match 헤더가 필요합니다.', {}, 428);
    if (expected !== w.draft_version) {
      return problem('MOA-WF-009', `다른 곳에서 먼저 저장했습니다. (내 버전 ${expected}, 서버 버전 ${w.draft_version})`, { current_version: w.draft_version, updated_at: w.updated_at });
    }
    const b = await body<WorkflowDefinition>(request);
    if (!Array.isArray(b.nodes) || !Array.isArray(b.edges)) return problem('MOA-VALIDATION', 'nodes와 edges가 필요합니다.');
    w.draft = { nodes: b.nodes, edges: b.edges, ...(b.inputs_schema ? { inputs_schema: b.inputs_schema } : {}) };
    w.draft_version += 1;
    w.updated_at = nowIso();
    const { issues } = validateDefinition(w.draft);
    return json({ draft_version: w.draft_version, issues });
  }),
  http.post(`${API}/workflows/:id/validate`, async ({ request, params }) => {
    const ctx = guard(request, 'maker');
    if (isResponse(ctx)) return ctx;
    const w = findWf(ctx.wsId, String(params.id));
    if (!w) return notFound('워크플로');
    const b = await body<Partial<WorkflowDefinition>>(request);
    const defn = Array.isArray(b.nodes) && Array.isArray(b.edges) ? (b as WorkflowDefinition) : w.draft;
    return json(validateDefinition(defn));
  }),
  http.get(`${API}/workflows/:id/versions`, ({ request, params }) => {
    const ctx = guard(request);
    if (isResponse(ctx)) return ctx;
    const w = findWf(ctx.wsId, String(params.id));
    if (!w) return notFound('워크플로');
    const items = db.workflow_versions
      .filter((v) => v.workflow_id === w.id)
      .sort((a, b) => b.version - a.version)
      .map(({ definition: _d, ...v }) => v);
    return json({ items, next_cursor: null });
  }),
  http.get(`${API}/workflows/:id/versions/:version`, ({ request, params }) => {
    const ctx = guard(request);
    if (isResponse(ctx)) return ctx;
    const w = findWf(ctx.wsId, String(params.id));
    const v = db.workflow_versions.find((x) => x.workflow_id === w?.id && x.version === Number(params.version));
    return v ? json(v) : notFound('버전');
  }),
  http.post(`${API}/workflows/:id/versions`, async ({ request, params }) => {
    const ctx = guard(request, 'maker');
    if (isResponse(ctx)) return ctx;
    const w = findWf(ctx.wsId, String(params.id));
    if (!w) return notFound('워크플로');
    const b = await body<{ note?: string }>(request);
    const { issues } = validateDefinition(w.draft);
    const errors = issues.filter((i) => i.severity === 'error');
    if (errors.length) return problem(errors[0]!.code, `검증 오류 ${errors.length}건이 있어 버전을 저장할 수 없습니다.`, { issues });
    const version = Math.max(0, ...db.workflow_versions.filter((v) => v.workflow_id === w.id).map((v) => v.version)) + 1;
    const v = { id: uuid(), workflow_id: w.id, version, definition: structuredClone(w.draft), def_hash: sha256ish(JSON.stringify(w.draft)), note: b.note?.trim() || null, created_by: ctx.userId, created_at: nowIso() };
    db.workflow_versions.push(v);
    return json(v, 201);
  }),
];

export { duplicateWorkflow, EMPTY_DRAFT };
