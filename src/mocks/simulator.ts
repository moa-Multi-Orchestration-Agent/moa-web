/**
 * 실행 시뮬레이터 (prompts.md 2단계 4)).
 * POST /runs가 run을 만들고 여기서 노드를 위상 순서대로 흉내 내며 SSE 이벤트를 쌓는다.
 * 이벤트는 실행마다 로그로 남겨, 재연결 시 Last-Event-ID 이후만 다시 보낸다.
 */
import type { NodeDef, WorkflowDefinition } from '@/entities/workflow/model';
import type { RunStatus } from '@/entities/run/model';
import { db, type DbContextBlock, type DbRun } from './db';
import { costOf, errorCodeFor, executionPlan, fakeOutput, failNodeFor, llmText, SAMPLE_GLB, SAMPLE_PREVIEW, tokensFor } from './engine';
import { countTokens, fid, nowIso, uuid } from './lib/util';

export interface SimEvent {
  id: number;
  event: string;
  data: Record<string, unknown>;
}

type Listener = (e: SimEvent) => void;

interface RunState {
  events: SimEvent[];
  listeners: Set<Listener>;
  plan: NodeDef[];
  index: number;
  canceled: boolean;
  definition: WorkflowDefinition;
  failNode: string | null;
  done: boolean;
  /** 승인 대기에서 재개할 위치 */
  waitingApproval: string | null;
  agentMode: boolean;
}

const runs = new Map<string, RunState>();

/** 시간 배율. 테스트에서는 0으로 두어 즉시 진행한다. */
export const simConfig = { speed: typeof process !== 'undefined' && process.env?.MOCK_DELAY === 'off' ? 0 : 1 };
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, Math.round(ms * simConfig.speed)));

export function resetSimulator() {
  runs.clear();
}

export function eventsOf(runId: string) {
  return runs.get(runId);
}

function emit(runId: string, event: string, data: Record<string, unknown>) {
  const st = runs.get(runId);
  if (!st) return;
  const ev: SimEvent = { id: st.events.length + 1, event, data };
  st.events.push(ev);
  for (const l of st.listeners) l(ev);
}

export function subscribe(runId: string, after: number, listener: Listener): () => void {
  const st = runs.get(runId);
  if (!st) return () => {};
  for (const ev of st.events.filter((e) => e.id > after)) listener(ev);
  st.listeners.add(listener);
  return () => st.listeners.delete(listener);
}

export function isStreamDone(runId: string) {
  const st = runs.get(runId);
  return !st || st.done;
}

function setStatus(run: DbRun, status: RunStatus, extra: Partial<DbRun> = {}) {
  Object.assign(run, { status, ...extra });
  emit(run.id, 'run.status', { run_id: run.id, status, at: nowIso(), error_code: run.error_code });
  if (status === 'succeeded' || status === 'failed' || status === 'canceled') {
    const st = runs.get(run.id);
    if (st) st.done = true;
  }
}

/** 에이전트 대화 실행용 가상 그래프: 모델 판단 → 스킬 → (워크플로) → (승인) → 답변 */
export function agentPlan(agentId: string, message: string): WorkflowDefinition {
  const agent = db.agents.find((a) => a.id === agentId);
  const skills = db.agent_skills.filter((s) => s.agent_id === agentId && (s.config as { enabled?: boolean }).enabled !== false);
  const nodes: NodeDef[] = [
    { id: 'in', type: 'input', name: '사용자 메시지', config: { fields: [{ name: 'message', type: 'string' }] }, ports_in: [], ports_out: [{ name: 'message', type: 'string' }] },
    { id: 'plan', type: 'llm', block: 'llm.generate', name: '모델 판단', config: { model: agent?.model ?? 'claude-sonnet-4' }, ports_in: [], ports_out: [] },
  ];
  const wantsWorkflow = /3d|3D|시각화|리포트|워크플로/.test(message);
  const wantsSend = /보내|공유|발송|send/i.test(message);
  for (const s of skills.slice(0, 3)) {
    const t = s.mcp_tool_id ? db.mcp_tools.find((x) => x.id === s.mcp_tool_id) : null;
    const label = s.builtin_skill ? (s.builtin_skill === 'web_search' ? '웹 검색' : s.builtin_skill === 'kb_search' ? 'RAG 검색' : s.builtin_skill === 'three_d' ? '2D → 3D 변환' : s.builtin_skill === 'mail_send' ? '메일 보내기' : s.builtin_skill) : (t?.annotations.title ?? t?.name ?? '도구');
    const destructive = s.require_approval;
    if (destructive && !wantsSend) continue;
    if (s.builtin_skill === 'three_d' && !wantsWorkflow) continue;
    if (destructive) {
      nodes.push({ id: `approve:${s.id}`, type: 'approval', name: `${label} 전 승인`, config: { summary: `${label} 실행 전 확인` }, ports_in: [], ports_out: [] });
    }
    nodes.push({ id: `skill:${s.id}`, type: s.builtin_skill === 'three_d' ? 'three_d' : s.builtin_skill === 'kb_search' ? 'kb_search' : 'tool', block: s.builtin_skill === 'web_search' ? 'tool.web_search' : undefined, name: label, config: { kind: 'skill' }, ports_in: [], ports_out: [] });
  }
  const link = db.agent_workflows.find((l) => l.agent_id === agentId);
  if (link && wantsWorkflow) {
    const w = db.workflows.find((x) => x.id === link.workflow_id);
    nodes.push({ id: `workflow:${link.workflow_id}`, type: 'tool', name: w?.name ?? link.alias, config: { kind: 'workflow' }, ports_in: [], ports_out: [] });
  }
  nodes.push({ id: 'answer', type: 'llm', block: 'llm.generate', name: '답변 생성', config: { model: agent?.model ?? 'claude-sonnet-4', answer: true }, ports_in: [], ports_out: [] });
  const edges = nodes.slice(1).map((n, i) => ({ id: `ae${i}`, source: nodes[i]!.id, source_port: 'out', target: n.id, target_port: 'in', condition: null }));
  return { nodes, edges };
}

function agentAnswer(message: string, agentName: string) {
  if (/fail/i.test(message)) return '';
  return `${agentName}입니다. 요청하신 "${message.slice(0, 40)}"에 대해 정리했어요.\n\n핵심 기능: 한 손 접이 구조, 알루미늄 X 프레임, 등받이 각도 2단. 참고한 자료는 디자인 가이드 v2와 유사 제품 5건입니다. 다음으로 소재 샘플을 비교해 보면 좋겠습니다.`;
}

/** 실행 시작. run 행은 호출 쪽에서 만들어 db.runs에 넣어 둔다. */
export function startSimulation(run: DbRun, definition: WorkflowDefinition, opts: { agentMode?: boolean } = {}) {
  const plan = executionPlan(definition);
  const st: RunState = {
    events: [],
    listeners: new Set(),
    plan,
    index: 0,
    canceled: false,
    definition,
    failNode: failNodeFor(plan, run.input),
    done: false,
    waitingApproval: null,
    agentMode: !!opts.agentMode,
  };
  runs.set(run.id, st);
  void (async () => {
    await sleep(250);
    setStatus(run, 'running', { started_at: nowIso() });
    await advance(run);
  })();
  startHeartbeat(run.id);
}

function startHeartbeat(runId: string) {
  if (simConfig.speed === 0) return;
  const timer = setInterval(() => {
    const st = runs.get(runId);
    if (!st || st.done) return clearInterval(timer);
    emit(runId, 'heartbeat', { ts: nowIso() });
  }, 15_000);
}

async function advance(run: DbRun) {
  const st = runs.get(run.id);
  if (!st) return;
  const session = db.context_sessions.find((s) => s.id === run.context_session_id);
  while (st.index < st.plan.length) {
    if (runs.get(run.id) !== st) return; // 리셋됨
    if (st.canceled || run.status === 'canceled') return;
    const node = st.plan[st.index]!;

    if (node.type === 'approval' && st.waitingApproval !== node.id) {
      const approvalId = uuid();
      const prev = st.plan[st.index - 1];
      const preview = prev ? String((fakeOutput(prev, run.input ?? {}) as { text?: string })?.text ?? `${prev.name} 결과`) : '';
      const summary = { title: node.name, message: String(node.config.summary ?? '이전 단계 결과를 확인하고 승인해 주세요.'), preview };
      db.approvals.push({ id: approvalId, run_id: run.id, workspace_id: run.workspace_id, node_id: node.id, summary, approvers: [], status: 'pending', decided_by: null, decided_at: null, comment: null, expires_at: new Date(Date.now() + 72 * 3600_000).toISOString(), created_at: nowIso() });
      const stepId = uuid();
      db.run_steps.push(stepRow(run, node, stepId, { ok: null, finished_at: null }));
      emit(run.id, 'step.started', { step_id: stepId, node_id: node.id, attempt: 1, node_type: node.type, node_name: node.name });
      st.waitingApproval = node.id;
      setStatus(run, 'waiting_approval');
      emit(run.id, 'approval.required', { approval_id: approvalId, node_id: node.id, summary });
      return; // 결정이 오면 resume
    }
    if (node.type === 'approval' && st.waitingApproval === node.id) {
      st.waitingApproval = null;
      st.index += 1;
      continue;
    }

    const ok = await runNode(run, node, st, session);
    if (!ok) return;
    st.index += 1;
  }
  if (st.canceled || runs.get(run.id) !== st) return;
  const last = [...st.plan].reverse().find((n) => n.type !== 'input');
  const output = st.agentMode
    ? { text: agentAnswer(String((run.input as { message?: string })?.message ?? ''), db.agents.find((a) => a.id === run.agent_id)?.name ?? '에이전트') }
    : last
      ? fakeOutput(last, run.input ?? {})
      : null;
  setStatus(run, 'succeeded', { finished_at: nowIso(), output });
}

function stepRow(run: DbRun, node: NodeDef, id: string, extra: Partial<(typeof db.run_steps)[number]> = {}) {
  return {
    id,
    run_id: run.id,
    node_id: node.id,
    node_type: node.type,
    attempt: 1,
    model: node.type === 'llm' ? String(node.config.model ?? 'claude-sonnet-4') : null,
    ok: null,
    input: null,
    output: null,
    error_code: null,
    tokens_in: 0,
    tokens_out: 0,
    cost_usd: 0,
    latency_ms: null,
    started_at: nowIso(),
    finished_at: null,
    node_name: node.name,
    fallback_used: false,
    kind: (node.id.startsWith('skill:') ? 'skill' : node.id.startsWith('workflow:') ? 'workflow' : node.id === 'plan' ? 'model' : 'node') as 'skill' | 'workflow' | 'model' | 'node',
    ...extra,
  };
}

async function runNode(run: DbRun, node: NodeDef, st: RunState, session: (typeof db.context_sessions)[number] | undefined): Promise<boolean> {
  const stepId = uuid();
  const started = Date.now();
  const fails = st.failNode === node.id;
  const step = stepRow(run, node, stepId, { input: st.index === 0 ? run.input : { from: st.plan[st.index - 1]?.id } });
  db.run_steps.push(step);
  const fallbacks = (node.config.fallback_models as string[] | undefined) ?? [];
  const useFallback = node.type === 'llm' && fallbacks.length > 0 && /retry|fallback/i.test(JSON.stringify(run.input ?? {}));
  emit(run.id, 'step.started', { step_id: stepId, node_id: node.id, attempt: 1, node_type: node.type, node_name: node.name, model: step.model, kind: step.kind });

  if (useFallback) {
    await sleep(500);
    step.attempt = 2;
    step.model = fallbacks[0]!;
    step.fallback_used = true;
    emit(run.id, 'step.started', { step_id: stepId, node_id: node.id, attempt: 2, node_type: node.type, node_name: node.name, model: step.model, kind: step.kind });
  }

  if (node.type === 'llm') {
    const isAnswer = st.agentMode && node.config.answer === true;
    const text = isAnswer ? agentAnswer(String((run.input as { message?: string })?.message ?? ''), db.agents.find((a) => a.id === run.agent_id)?.name ?? '에이전트') : st.agentMode ? '필요한 도구를 골라 진행합니다.' : llmText(node);
    // 글자 단위 토큰 30~80개로 나눠 흘린다
    const chunks = Math.min(80, Math.max(30, Math.ceil(text.length / 3)), Math.max(1, text.length));
    for (let c = 0; c < chunks && !fails; c++) {
      if (st.canceled) return false;
      const a = Math.floor((c * text.length) / chunks);
      const b = Math.floor(((c + 1) * text.length) / chunks);
      emit(run.id, 'step.delta', { step_id: stepId, node_id: node.id, text: text.slice(a, b) });
      await sleep(35);
    }
  } else if (node.type === 'three_d') {
    await sleep(2500);
  } else {
    await sleep(node.type === 'input' || node.type === 'output' ? 200 : 700);
  }
  if (st.canceled) return false;

  if (fails) {
    await sleep(400);
    const code = errorCodeFor(node);
    Object.assign(step, { ok: false, attempt: 3, error_code: code, latency_ms: Date.now() - started, finished_at: nowIso() });
    emit(run.id, 'step.finished', { step_id: stepId, node_id: node.id, ok: false, latency_ms: step.latency_ms, tokens: { in: 0, out: 0 }, cost: 0, error_code: code, attempt: 3 });
    setStatus(run, 'failed', { error_code: code, error_detail: { node_id: node.id, message: `${node.name} 단계가 3번 시도 후 실패했습니다.` }, finished_at: nowIso() });
    return false;
  }

  const tok = tokensFor(node, run.id.length);
  const cost = costOf(step.model, tok.in, tok.out);
  let output = fakeOutput(node, (run.input as Record<string, unknown>) ?? {});
  if (node.type === 'three_d') {
    const assetId = uuid();
    db.assets_3d.push({ id: assetId, workspace_id: run.workspace_id, run_id: run.id, step_id: stepId, s3_key: `assets/${run.id}/out.glb`, preview_key: `assets/${run.id}/preview.png`, format: 'glb', poly_count: 4212, bytes: 120_484, created_at: nowIso(), url: SAMPLE_GLB, preview_url: SAMPLE_PREVIEW });
    output = { ...(output as object), asset_id: assetId };
  }
  Object.assign(step, { ok: true, output, tokens_in: tok.in, tokens_out: tok.out, cost_usd: cost, latency_ms: Date.now() - started, finished_at: nowIso() });
  run.tokens_in += tok.in;
  run.tokens_out += tok.out;
  run.cost_usd = Number((run.cost_usd + cost).toFixed(6));
  if (cost > 0 && step.model) {
    db.usage_ledger.push({ id: db.usage_ledger.length + 100_000, workspace_id: run.workspace_id, run_id: run.id, step_id: stepId, agent_id: run.agent_id, endpoint_id: run.endpoint_id, model: step.model, tokens_in: tok.in, tokens_out: tok.out, cost_usd: cost, created_at: nowIso() });
  }
  emit(run.id, 'step.finished', { step_id: stepId, node_id: node.id, ok: true, latency_ms: step.latency_ms, tokens: { in: tok.in, out: tok.out }, cost, output, attempt: step.attempt, model: step.model });

  if (session && (node.type === 'llm' || node.type === 'tool' || node.type === 'kb_search' || node.type === 'three_d')) {
    appendContext(run, session, node, output);
  }
  return true;
}

/** 블록 추가 → context.changed. 임계치를 넘으면 오래된 비고정 블록을 요약으로 압축(design.md 2.1.3). */
function appendContext(run: DbRun, session: (typeof db.context_sessions)[number], node: NodeDef, output: unknown) {
  const role: DbContextBlock['role'] = node.type === 'llm' ? 'history' : 'tool';
  const content = node.type === 'llm' ? String((output as { text?: string })?.text ?? llmText(node)) : `${node.name} 결과: ${JSON.stringify(output).slice(0, 400)}`;
  const tokens = role === 'tool' ? 900 + countTokens(content) * 3 : 400 + countTokens(content);
  session.last_seq += 1;
  const now = nowIso();
  db.context_blocks.push({ id: uuid(), session_id: session.id, seq: session.last_seq, role, content, token_count: tokens, pinned: false, enabled: true, priority: 50, source_node: node.id, compressed_into: null, expires_at: null, version: 1, created_at: now, updated_at: now });
  const ws = db.workspaces.find((w) => w.id === run.workspace_id);
  const threshold = ws?.settings.compress_threshold ?? 0.7;
  let used = enabledTokens(session.id);
  let compressed = false;
  if (used > session.budget_tokens * threshold) {
    const target = session.budget_tokens * 0.5;
    const movable = db.context_blocks.filter((b) => b.session_id === session.id && b.enabled && !b.pinned && (b.role === 'history' || b.role === 'tool')).sort((a, b) => a.seq - b.seq);
    const keepTail = movable.slice(-2);
    const candidates = movable.filter((b) => !keepTail.includes(b));
    const chunk: DbContextBlock[] = [];
    let acc = 0;
    for (const b of candidates) {
      chunk.push(b);
      acc += b.token_count;
      if (used - acc + 200 <= target) break;
    }
    if (chunk.length) {
      session.last_seq += 1;
      const summaryId = uuid();
      const summaryTokens = Math.max(120, Math.round(acc / 6));
      db.context_blocks.push({ id: summaryId, session_id: session.id, seq: session.last_seq, role: 'summary', content: `이전 ${chunk.length}개 블록 요약: ${chunk.map((b) => b.content.slice(0, 30)).join(' / ')}`, token_count: summaryTokens, pinned: false, enabled: true, priority: 70, source_node: null, compressed_into: null, expires_at: null, version: 1, created_at: nowIso(), updated_at: nowIso() });
      for (const b of chunk) Object.assign(b, { enabled: false, compressed_into: summaryId, version: b.version + 1, updated_at: nowIso() });
      db.compression_logs.push({ id: db.compression_logs.length + 1, session_id: session.id, summary_block_id: summaryId, source_block_ids: chunk.map((b) => b.id), strategy: 'summarize', saved_tokens: acc - summaryTokens, created_at: nowIso() });
      compressed = true;
      used = enabledTokens(session.id);
    }
  }
  session.used_tokens = used;
  emit(run.id, 'context.changed', { session_id: session.id, used_tokens: used, budget: session.budget_tokens, compressed });
}

function enabledTokens(sessionId: string) {
  return db.context_blocks.filter((b) => b.session_id === sessionId && b.enabled).reduce((s, b) => s + b.token_count, 0);
}

/** 승인 결정 후 재개 */
export function resumeAfterApproval(run: DbRun, approve: boolean, comment: string | null) {
  const st = runs.get(run.id);
  const node = st?.plan[st.index];
  const step = [...db.run_steps].reverse().find((s) => s.run_id === run.id && s.node_id === node?.id && s.ok === null);
  if (step) Object.assign(step, { ok: approve, finished_at: nowIso(), latency_ms: Date.now() - new Date(step.started_at).getTime(), output: { approved: approve, comment } });
  if (step) emit(run.id, 'step.finished', { step_id: step.id, node_id: step.node_id, ok: approve, latency_ms: step.latency_ms, tokens: { in: 0, out: 0 }, cost: 0, error_code: approve ? null : 'MOA-APR-002' });
  if (!approve) {
    setStatus(run, 'failed', { error_code: 'MOA-APR-002', error_detail: { message: '승인이 거부되었습니다.', comment }, finished_at: nowIso() });
    return;
  }
  if (!st) {
    // 시드 데이터처럼 시뮬레이터 상태가 없는 실행: 남은 단계를 그 자리에서 마무리
    finishSeededRun(run);
    return;
  }
  setStatus(run, 'running');
  void advance(run);
}

/** 시뮬레이터 없이 시드로만 존재하는 실행을 재개할 때 */
function finishSeededRun(run: DbRun) {
  const wf = db.workflows.find((w) => w.id === run.workflow_id);
  if (!wf) {
    Object.assign(run, { status: 'succeeded', finished_at: nowIso() });
    return;
  }
  const plan = executionPlan(wf.draft);
  const doneIds = new Set(db.run_steps.filter((s) => s.run_id === run.id).map((s) => s.node_id));
  const st: RunState = { events: [], listeners: new Set(), plan, index: plan.findIndex((n) => !doneIds.has(n.id)), canceled: false, definition: wf.draft, failNode: null, done: false, waitingApproval: null, agentMode: false };
  if (st.index < 0) st.index = plan.length;
  runs.set(run.id, st);
  setStatus(run, 'running');
  void advance(run);
}

export function cancelSimulation(run: DbRun) {
  const st = runs.get(run.id);
  if (st) st.canceled = true;
  const open = db.run_steps.filter((s) => s.run_id === run.id && s.ok === null);
  for (const s of open) Object.assign(s, { ok: false, error_code: 'MOA-RUN-001', finished_at: nowIso() });
  for (const a of db.approvals.filter((x) => x.run_id === run.id && x.status === 'pending')) a.status = 'expired';
  if (!st) runs.set(run.id, { events: [], listeners: new Set(), plan: [], index: 0, canceled: true, definition: { nodes: [], edges: [] }, failNode: null, done: false, waitingApproval: null, agentMode: false });
  setStatus(run, 'canceled', { finished_at: nowIso() });
}

/** 시드 실행처럼 이벤트 로그가 없는 실행의 SSE: 현재 상태 한 번 보내고 끝 */
export function ensureStateForSeeded(run: DbRun) {
  if (runs.has(run.id)) return;
  const st: RunState = { events: [], listeners: new Set(), plan: [], index: 0, canceled: false, definition: { nodes: [], edges: [] }, failNode: null, done: run.status !== 'waiting_approval' && run.status !== 'running' && run.status !== 'queued', waitingApproval: null, agentMode: false };
  runs.set(run.id, st);
  emit(run.id, 'run.status', { run_id: run.id, status: run.status, at: nowIso(), error_code: run.error_code });
  if (run.status === 'waiting_approval') {
    const a = db.approvals.find((x) => x.run_id === run.id && x.status === 'pending');
    if (a) emit(run.id, 'approval.required', { approval_id: a.id, node_id: a.node_id, summary: a.summary });
  }
}

export { fid };
