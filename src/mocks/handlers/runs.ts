import { http, HttpResponse } from 'msw';
import type { WorkflowDefinition } from '@/entities/workflow/model';
import { db, type DbRun } from '../db';
import { API, body, guard, isResponse, json, notFound, paginate, problem } from '../lib/http';
import { nowIso, uuid } from '../lib/util';
import { agentPlan, cancelSimulation, ensureStateForSeeded, eventsOf, isStreamDone, resumeAfterApproval, startSimulation, subscribe } from '../simulator';
import { approvalView, runDetailView, runView } from '../views';

const TERMINAL = ['succeeded', 'failed', 'canceled'];

function monthSpent(wsId: string) {
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  return db.usage_ledger.filter((l) => l.workspace_id === wsId && l.created_at >= start.toISOString()).reduce((s, l) => s + l.cost_usd, 0);
}

export interface CreateRunBody {
  workflow_id?: string;
  agent_id?: string;
  endpoint_id?: string;
  api_key_id?: string;
  input?: Record<string, unknown>;
  trigger?: DbRun['trigger'];
  context_session_id?: string;
  definition?: WorkflowDefinition;
  rerun_of?: string;
}

/** run 행을 만들고 시뮬레이터를 시작한다. 배포 API 호출도 이 함수를 쓴다. */
export function createRun(wsId: string, b: CreateRunBody): DbRun | Response {
  const budget = db.budgets.find((x) => x.workspace_id === wsId && x.scope_type === 'workspace');
  if (budget?.monthly_limit_usd != null && monthSpent(wsId) >= budget.monthly_limit_usd) {
    return problem('MOA-BUD-001', `이번 달 예산 $${budget.monthly_limit_usd}을 모두 썼습니다. 설정 > 예산에서 한도를 올리세요.`);
  }
  let definition: WorkflowDefinition | null = null;
  let workflowId: string | null = b.workflow_id ?? null;
  let versionId: string | null = null;
  const agent = b.agent_id ? db.agents.find((a) => a.id === b.agent_id && a.workspace_id === wsId && !a.deleted_at) : null;
  if (b.agent_id && !agent) return notFound('에이전트');
  const isChat = !!agent && typeof b.input?.message === 'string' && !b.workflow_id;

  if (isChat) {
    definition = agentPlan(agent!.id, String(b.input!.message));
  } else {
    workflowId = workflowId ?? agent?.primary_workflow_id ?? null;
    const w = workflowId ? db.workflows.find((x) => x.id === workflowId && x.workspace_id === wsId && !x.deleted_at) : null;
    if (!w) return problem('MOA-VALIDATION', '실행할 워크플로가 없습니다. 에이전트에 워크플로를 연결하세요.', {}, 422);
    definition = b.definition ?? w.draft;
    const versions = db.workflow_versions.filter((v) => v.workflow_id === w.id).sort((x, y) => y.version - x.version);
    versionId = b.endpoint_id ? (db.endpoints.find((e) => e.id === b.endpoint_id)?.workflow_version_id ?? null) : (versions[0]?.id ?? `draft-${w.id}-${w.draft_version}`);
  }

  // 컨텍스트 세션: 에이전트 대화는 세션을 이어 쓴다
  let sessionId = b.context_session_id && db.context_sessions.some((s) => s.id === b.context_session_id) ? b.context_session_id : null;
  const runId = uuid();
  if (!sessionId) {
    sessionId = uuid();
    db.context_sessions.push({ id: sessionId, workspace_id: wsId, agent_id: agent?.id ?? null, run_id: runId, model_family: 'anthropic', last_seq: 0, used_tokens: 0, created_at: nowIso(), budget_tokens: 8000 });
    const sys = agent?.system_prompt || '너는 워크플로 실행 보조자다.';
    db.context_blocks.push({ id: uuid(), session_id: sessionId, seq: 1, role: 'system', content: sys, token_count: 320, pinned: true, enabled: true, priority: 100, source_node: '에이전트 구성', compressed_into: null, expires_at: null, version: 1, created_at: nowIso(), updated_at: nowIso() });
    db.context_sessions.at(-1)!.last_seq = 1;
  }
  const session = db.context_sessions.find((s) => s.id === sessionId)!;
  session.last_seq += 1;
  const userText = isChat ? String(b.input!.message) : JSON.stringify(b.input ?? {});
  db.context_blocks.push({ id: uuid(), session_id: session.id, seq: session.last_seq, role: 'user', content: userText, token_count: Math.max(20, Math.ceil(userText.length / 2)), pinned: false, enabled: true, priority: 50, source_node: null, compressed_into: null, expires_at: null, version: 1, created_at: nowIso(), updated_at: nowIso() });

  const run: DbRun = {
    id: runId,
    workspace_id: wsId,
    agent_id: agent?.id ?? null,
    workflow_id: isChat ? null : workflowId,
    workflow_version_id: versionId,
    endpoint_id: b.endpoint_id ?? null,
    api_key_id: b.api_key_id ?? null,
    trigger: b.trigger ?? 'editor',
    status: 'queued',
    input: b.input ?? {},
    output: null,
    error_code: null,
    error_detail: null,
    cost_usd: 0,
    tokens_in: 0,
    tokens_out: 0,
    started_at: null,
    finished_at: null,
    created_at: nowIso(),
    context_session_id: session.id,
    rerun_of: b.rerun_of ?? null,
  };
  db.runs.push(run);
  startSimulation(run, definition!, { agentMode: isChat });
  return run;
}

function filterRuns(wsId: string, url: URL) {
  const sp = url.searchParams;
  let items = db.runs.filter((r) => r.workspace_id === wsId).map(runView);
  const status = sp.get('status');
  if (status) items = items.filter((r) => status.split(',').includes(r.status));
  const trigger = sp.get('trigger');
  if (trigger) items = items.filter((r) => r.trigger === trigger);
  const agentId = sp.get('agent_id');
  if (agentId) items = items.filter((r) => r.agent_id === agentId);
  const workflowId = sp.get('workflow_id');
  if (workflowId) items = items.filter((r) => r.workflow_id === workflowId);
  const kind = sp.get('kind');
  if (kind) items = items.filter((r) => r.target_kind === kind);
  const from = sp.get('from');
  if (from) items = items.filter((r) => r.created_at >= from);
  const to = sp.get('to');
  if (to) items = items.filter((r) => r.created_at <= to);
  return items.sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id));
}

export const runHandlers = [
  http.get(`${API}/runs`, ({ request }) => {
    const ctx = guard(request);
    if (isResponse(ctx)) return ctx;
    const url = new URL(request.url);
    const items = filterRuns(ctx.wsId, url);
    const counts = Object.fromEntries(['running', 'waiting_approval', 'failed', 'succeeded', 'canceled', 'queued'].map((s) => [s, db.runs.filter((r) => r.workspace_id === ctx.wsId && r.status === s).length]));
    return json({ ...paginate(items, url, 20), counts });
  }),
  http.post(`${API}/runs`, async ({ request }) => {
    const ctx = guard(request, 'maker');
    if (isResponse(ctx)) return ctx;
    const b = await body<CreateRunBody>(request);
    const run = createRun(ctx.wsId, b);
    if (run instanceof Response) return run;
    return json(runView(run), 201);
  }),
  http.get(`${API}/runs/:id`, ({ request, params }) => {
    const ctx = guard(request);
    if (isResponse(ctx)) return ctx;
    const r = db.runs.find((x) => x.id === params.id && x.workspace_id === ctx.wsId);
    return r ? json(runDetailView(r)) : notFound('실행');
  }),
  http.post(`${API}/runs/:id/cancel`, ({ request, params }) => {
    const ctx = guard(request, 'maker');
    if (isResponse(ctx)) return ctx;
    const r = db.runs.find((x) => x.id === params.id && x.workspace_id === ctx.wsId);
    if (!r) return notFound('실행');
    if (TERMINAL.includes(r.status)) return problem('MOA-RUN-001', `이미 ${r.status} 상태라 취소할 수 없습니다.`);
    cancelSimulation(r);
    return json(runView(r));
  }),
  // SSE (design.md 1.5.2). 재연결하면 Last-Event-ID 다음 이벤트부터 보낸다.
  http.get(`${API}/runs/:id/events`, ({ request, params }) => {
    const ctx = guard(request);
    if (isResponse(ctx)) return ctx;
    const run = db.runs.find((x) => x.id === params.id && x.workspace_id === ctx.wsId);
    if (!run) return notFound('실행');
    if (!eventsOf(run.id)) ensureStateForSeeded(run);
    const url = new URL(request.url);
    const after = Number(request.headers.get('Last-Event-ID') ?? url.searchParams.get('last_event_id') ?? 0) || 0;
    const encoder = new TextEncoder();
    let unsub: (() => void) | null = null;
    let closed = false;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const close = () => {
          if (closed) return;
          closed = true;
          unsub?.();
          try {
            controller.close();
          } catch {
            /* 이미 닫힘 */
          }
        };
        controller.enqueue(encoder.encode('retry: 1000\n\n'));
        unsub = subscribe(run.id, after, (ev) => {
          if (closed) return;
          controller.enqueue(encoder.encode(`id: ${ev.id}\nevent: ${ev.event}\ndata: ${JSON.stringify(ev.data)}\n\n`));
          if (ev.event === 'run.status' && TERMINAL.includes(String(ev.data.status))) setTimeout(close, 50);
        });
        if (isStreamDone(run.id) && (eventsOf(run.id)?.events.at(-1)?.id ?? 0) <= after) setTimeout(close, 50);
      },
      cancel() {
        closed = true;
        unsub?.();
      },
    });
    return new HttpResponse(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' } });
  }),
  http.get(`${API}/approvals`, ({ request }) => {
    const ctx = guard(request);
    if (isResponse(ctx)) return ctx;
    const status = new URL(request.url).searchParams.get('status');
    const items = db.approvals
      .filter((a) => a.workspace_id === ctx.wsId && (!status || a.status === status))
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map(approvalView);
    return json({ items, next_cursor: null });
  }),
  http.post(`${API}/approvals/:id/decision`, async ({ request, params }) => {
    const ctx = guard(request);
    if (isResponse(ctx)) return ctx;
    const a = db.approvals.find((x) => x.id === params.id && x.workspace_id === ctx.wsId);
    if (!a) return notFound('승인 요청');
    // 승인자 목록에 있거나 admin 이상 (design.md 2.2.4)
    const isApprover = a.approvers.includes(ctx.userId);
    if (!isApprover && ctx.role !== 'admin' && ctx.role !== 'owner') return problem('MOA-AUTH-003', '승인자이거나 관리자 이상만 결정할 수 있습니다.');
    if (a.status !== 'pending') return problem('MOA-APR-001');
    if (new Date(a.expires_at).getTime() < Date.now()) {
      a.status = 'expired';
      return problem('MOA-APR-002');
    }
    const b = await body<{ approve: boolean; comment?: string }>(request);
    Object.assign(a, { status: b.approve ? 'approved' : 'rejected', decided_by: ctx.userId, decided_at: nowIso(), comment: b.comment ?? null });
    const run = db.runs.find((r) => r.id === a.run_id);
    if (run && run.status === 'waiting_approval') resumeAfterApproval(run, !!b.approve, b.comment ?? null);
    return json(approvalView(a));
  }),
];
