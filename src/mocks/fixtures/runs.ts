/** 실행 이력 시드: 성공·실패·승인 대기·취소를 섞은 30건 + 단계·승인·3D 에셋·컨텍스트·원장 */
import type { WorkflowDefinition } from '@/entities/workflow/model';
import type { RunStatus } from '@/entities/run/model';
import type {
  DbApproval,
  DbAsset,
  DbContextBlock,
  DbContextSession,
  DbLedger,
  DbRun,
  DbRunStep,
} from '../db';
import { costOf, errorCodeFor, executionPlan, fakeOutput, latencyFor, SAMPLE_GLB, SAMPLE_PREVIEW, tokensFor } from '../engine';
import { DAY, HOUR, MIN, countTokens, fid, iso } from '../lib/util';

export interface RunSeedSpec {
  workflowId: string;
  versionId: string;
  definition: WorkflowDefinition;
  agentId: string | null;
  endpointId?: string | null;
  apiKeyId?: string | null;
  trigger: DbRun['trigger'];
  status: RunStatus;
  ageMs: number;
  input: Record<string, unknown>;
  model: string;
}

export interface RunSeedOut {
  runs: DbRun[];
  steps: DbRunStep[];
  approvals: DbApproval[];
  assets: DbAsset[];
  sessions: DbContextSession[];
  blocks: DbContextBlock[];
  ledger: DbLedger[];
}

export function seedRuns(wsId: string, specs: RunSeedSpec[], now: number, idOffset = 0): RunSeedOut {
  const out: RunSeedOut = { runs: [], steps: [], approvals: [], assets: [], sessions: [], blocks: [], ledger: [] };
  let ledgerId = idOffset * 1000;
  specs.forEach((s, idx) => {
    const n = idOffset + idx + 1;
    const runId = fid('r', n);
    const sessionId = fid('cs', n);
    const plan = executionPlan(s.definition);
    const created = now - s.ageMs;
    let t = created + 400;
    let stopAt = plan.length;
    let failIdx = -1;
    if (s.status === 'failed') failIdx = Math.max(1, Math.floor(plan.length / 2));
    if (s.status === 'waiting_approval') stopAt = Math.max(1, plan.findIndex((x) => x.type === 'approval') + 1 || plan.length - 1);
    if (s.status === 'canceled') stopAt = Math.max(1, Math.floor(plan.length / 2));
    if (s.status === 'running') stopAt = Math.max(1, plan.length - 1);

    let tin = 0;
    let tout = 0;
    let cost = 0;
    let errorCode: string | null = null;
    let lastOutput: unknown = null;
    const limit = failIdx >= 0 ? failIdx + 1 : stopAt;
    for (let i = 0; i < Math.min(limit, plan.length); i++) {
      const node = plan[i]!;
      const isFail = i === failIdx;
      const isApproval = node.type === 'approval' && s.status === 'waiting_approval' && i === stopAt - 1;
      const isOpen = (s.status === 'running' && i === stopAt - 1) || isApproval;
      const tok = tokensFor(node, n);
      const lat = latencyFor(node, n) * (isFail ? 3 : 1);
      const model = node.type === 'llm' ? String(node.config.model ?? s.model) : null;
      const fallbackUsed = node.type === 'llm' && n % 7 === 3 && Array.isArray(node.config.fallback_models) && (node.config.fallback_models as string[]).length > 0;
      const c = costOf(model, tok.in, tok.out);
      const stepId = fid('st', n * 100 + i);
      const output = isFail || isOpen ? null : fakeOutput(node, s.input);
      out.steps.push({
        id: stepId,
        run_id: runId,
        node_id: node.id,
        node_type: node.type,
        attempt: isFail ? 3 : fallbackUsed ? 2 : 1,
        model: fallbackUsed ? ((node.config.fallback_models as string[])[0] ?? model) : model,
        ok: isOpen ? null : !isFail,
        input: i === 0 ? s.input : { from: plan[i - 1]?.id },
        output,
        error_code: isFail ? errorCodeFor(node) : null,
        tokens_in: isOpen ? 0 : tok.in,
        tokens_out: isOpen ? 0 : tok.out,
        cost_usd: isOpen ? 0 : c,
        latency_ms: isOpen ? null : lat,
        started_at: iso(t),
        finished_at: isOpen ? null : iso(t + lat),
        node_name: node.name,
        fallback_used: fallbackUsed,
        kind: 'node',
      });
      if (!isOpen) {
        tin += tok.in;
        tout += tok.out;
        cost += c;
        if (c > 0 && model) {
          out.ledger.push({ id: ++ledgerId, workspace_id: wsId, run_id: runId, step_id: stepId, agent_id: s.agentId, endpoint_id: s.endpointId ?? null, model, tokens_in: tok.in, tokens_out: tok.out, cost_usd: c, created_at: iso(t + lat) });
        }
      }
      if (isFail) errorCode = errorCodeFor(node);
      if (output !== null) lastOutput = output;
      if (node.type === 'three_d' && output) {
        out.assets.push({ id: fid('as', n), workspace_id: wsId, run_id: runId, step_id: stepId, s3_key: `assets/${runId}/out.glb`, preview_key: `assets/${runId}/preview.png`, format: 'glb', poly_count: 4212, bytes: 120_484, created_at: iso(t + lat), url: SAMPLE_GLB, preview_url: SAMPLE_PREVIEW });
      }
      if (isApproval) {
        out.approvals.push({
          id: fid('ap', n),
          run_id: runId,
          workspace_id: wsId,
          node_id: node.id,
          summary: { title: `${node.name}`, message: '이전 단계 결과를 확인하고 승인해 주세요.', preview: typeof plan[i - 1] !== 'undefined' ? String((fakeOutput(plan[i - 1]!, s.input) as { text?: string })?.text ?? '결과 미리보기') : '' },
          approvers: [],
          status: 'pending',
          decided_by: null,
          decided_at: null,
          comment: null,
          expires_at: iso(t + 72 * HOUR),
          created_at: iso(t),
        });
      }
      t += lat + 150;
    }

    const finished = s.status === 'succeeded' || s.status === 'failed' || s.status === 'canceled';
    out.runs.push({
      id: runId,
      workspace_id: wsId,
      agent_id: s.agentId,
      workflow_id: s.workflowId,
      workflow_version_id: s.versionId,
      endpoint_id: s.endpointId ?? null,
      api_key_id: s.apiKeyId ?? null,
      trigger: s.trigger,
      status: s.status,
      input: s.input,
      output: s.status === 'succeeded' ? lastOutput : null,
      error_code: s.status === 'failed' ? errorCode : s.status === 'canceled' ? null : null,
      error_detail: s.status === 'failed' ? { message: '모델 응답이 3회 연속 시간 초과되었습니다.' } : null,
      cost_usd: Number(cost.toFixed(6)),
      tokens_in: tin,
      tokens_out: tout,
      started_at: iso(created + 300),
      finished_at: finished ? iso(t) : null,
      created_at: iso(created),
      context_session_id: sessionId,
      rerun_of: null,
    });

    // 컨텍스트 세션·블록(간단히)
    const blocks: [DbContextBlock['role'], string, boolean][] = [
      ['system', '너는 워크플로 실행 보조자다. 각 단계 결과를 다음 단계 입력으로 정리한다.', true],
      ['user', JSON.stringify(s.input), false],
      ['tool', '검색·도구 결과 요약: 관련 자료 5건', false],
      ['history', '중간 결과: 핵심 요약 초안', false],
    ];
    let used = 0;
    blocks.forEach(([role, content, pinned], bi) => {
      const tc = countTokens(content) * (role === 'tool' ? 40 : role === 'history' ? 20 : 4);
      used += tc;
      out.blocks.push({ id: fid('cb', n * 10 + bi), session_id: sessionId, seq: bi + 1, role, content, token_count: tc, pinned, enabled: true, priority: pinned ? 90 : 50, source_node: plan[bi]?.id ?? null, compressed_into: null, expires_at: null, version: 1, created_at: iso(created + bi * MIN), updated_at: iso(created + bi * MIN) });
    });
    out.sessions.push({ id: sessionId, workspace_id: wsId, agent_id: s.agentId, run_id: runId, model_family: 'anthropic', last_seq: blocks.length, used_tokens: used, created_at: iso(created), budget_tokens: 8000 });
  });
  return out;
}

/** 30일 사용량 차트용 합성 원장(실행과 별개, 하루 단위 집계에 쓰임) */
export function syntheticLedger(wsId: string, agents: { id: string; model: string }[], now: number, startId: number): DbLedger[] {
  const rows: DbLedger[] = [];
  let id = startId;
  for (let d = 29; d >= 1; d--) {
    for (const [i, a] of agents.entries()) {
      const runs = 1 + ((d * 7 + i * 3) % 4);
      for (let r = 0; r < runs; r++) {
        const tin = 1200 + ((d * 131 + i * 17 + r * 7) % 1800);
        const tout = 300 + ((d * 59 + i * 11 + r * 5) % 700);
        rows.push({ id: ++id, workspace_id: wsId, run_id: `hist-${d}-${i}-${r}`, step_id: null, agent_id: a.id, endpoint_id: null, model: a.model, tokens_in: tin, tokens_out: tout, cost_usd: costOf(a.model, tin, tout), created_at: iso(now - d * DAY + i * HOUR + r * 7 * MIN) });
      }
    }
  }
  return rows;
}
