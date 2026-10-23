import { z } from 'zod';
import { camelKeys } from '@/shared/lib/case';

export const RUN_STATUSES = ['queued', 'running', 'waiting_approval', 'succeeded', 'failed', 'canceled'] as const;
export const runStatusSchema = z.enum(RUN_STATUSES);
export type RunStatus = z.infer<typeof runStatusSchema>;
export const TERMINAL: RunStatus[] = ['succeeded', 'failed', 'canceled'];
export const isTerminal = (s: string | null | undefined) => !!s && (TERMINAL as string[]).includes(s);

export const RUN_TRIGGERS = ['editor', 'api', 'schedule', 'slash', 'market'] as const;
export const runTriggerSchema = z.enum(RUN_TRIGGERS);

export const runStepRowSchema = z
  .object({
    id: z.string(),
    run_id: z.string(),
    node_id: z.string(),
    node_type: z.string(),
    attempt: z.number(),
    model: z.string().nullable(),
    ok: z.boolean().nullable(),
    input: z.unknown().nullable(),
    output: z.unknown().nullable(),
    error_code: z.string().nullable(),
    tokens_in: z.number(),
    tokens_out: z.number(),
    cost_usd: z.number(),
    latency_ms: z.number().nullable(),
    started_at: z.string(),
    finished_at: z.string().nullable(),
    /** 표시용 확장 */
    node_name: z.string().optional(),
    fallback_used: z.boolean().optional(),
    kind: z.enum(['node', 'skill', 'workflow', 'model']).optional(),
  })
  ;
export type RunStepRow = z.infer<typeof runStepRowSchema>;

export const approvalRowSchema = z
  .object({
    id: z.string(),
    run_id: z.string(),
    workspace_id: z.string(),
    node_id: z.string(),
    summary: z.object({ title: z.string(), message: z.string(), preview: z.string().optional() }),
    approvers: z.array(z.string()),
    status: z.enum(['pending', 'approved', 'rejected', 'expired']),
    decided_by: z.string().nullable(),
    decided_at: z.string().nullable(),
    comment: z.string().nullable(),
    expires_at: z.string(),
    created_at: z.string(),
    /** 표시용 확장 */
    target_name: z.string().optional(),
    target_kind: z.enum(['agent', 'workflow']).optional(),
  })
  ;
export type ApprovalRow = z.infer<typeof approvalRowSchema>;
export const toApproval = (r: ApprovalRow) => camelKeys(r);
export type Approval = ReturnType<typeof toApproval>;

export const asset3dRowSchema = z
  .object({
    id: z.string(),
    run_id: z.string(),
    step_id: z.string().nullable(),
    s3_key: z.string(),
    preview_key: z.string().nullable(),
    format: z.string(),
    poly_count: z.number().nullable(),
    bytes: z.number().nullable(),
    created_at: z.string(),
    url: z.string(),
    preview_url: z.string().nullable(),
  })
  ;
export type Asset3dRow = z.infer<typeof asset3dRowSchema>;

export const runRowSchema = z
  .object({
    id: z.string(),
    workspace_id: z.string(),
    agent_id: z.string().nullable(),
    workflow_version_id: z.string().nullable(),
    endpoint_id: z.string().nullable(),
    api_key_id: z.string().nullable(),
    trigger: runTriggerSchema,
    status: runStatusSchema,
    input: z.unknown().nullable(),
    output: z.unknown().nullable(),
    error_code: z.string().nullable(),
    error_detail: z.unknown().nullable(),
    cost_usd: z.number(),
    tokens_in: z.number(),
    tokens_out: z.number(),
    started_at: z.string().nullable(),
    finished_at: z.string().nullable(),
    created_at: z.string(),
    /** 표시용 확장 */
    workflow_id: z.string().nullable(),
    target_name: z.string(),
    target_kind: z.enum(['agent', 'workflow']),
    context_session_id: z.string().nullable(),
    rerun_of: z.string().nullable().optional(),
  })
  ;
export type RunRow = z.infer<typeof runRowSchema>;
export const toRun = (r: RunRow) => camelKeys(r);
export type Run = ReturnType<typeof toRun>;

export const runDetailSchema = runRowSchema.extend({
  steps: z.array(runStepRowSchema),
  approvals: z.array(approvalRowSchema),
  assets: z.array(asset3dRowSchema),
});
export type RunDetailRow = z.infer<typeof runDetailSchema>;

/** SSE 이벤트 데이터 (design.md 1.5.2) */
export interface RunEvents {
  'run.status': { run_id: string; status: RunStatus; at: string; error_code?: string | null };
  'step.started': { step_id: string; node_id: string; attempt: number; node_type?: string; node_name?: string; model?: string | null; kind?: string };
  'step.delta': { step_id: string; node_id?: string; text: string };
  'step.finished': {
    step_id: string;
    node_id?: string;
    ok: boolean;
    latency_ms: number;
    tokens: { in: number; out: number };
    cost: number;
    error_code?: string | null;
    output?: unknown;
    attempt?: number;
    model?: string | null;
  };
  'context.changed': { session_id: string; used_tokens: number; budget: number; compressed: boolean };
  'approval.required': { approval_id: string; node_id: string; summary: ApprovalRow['summary'] };
  heartbeat: { ts: string };
}

export interface StartRunInput {
  workflow_id?: string;
  agent_id?: string;
  endpoint_id?: string;
  input: Record<string, unknown>;
  trigger?: (typeof RUN_TRIGGERS)[number];
  context_session_id?: string;
  /** 편집기 테스트 실행: 저장 전 초안 그대로 */
  definition?: unknown;
  rerun_of?: string;
}

export interface RunListParams {
  status?: string;
  trigger?: string;
  agent_id?: string;
  workflow_id?: string;
  kind?: 'agent' | 'workflow';
  from?: string;
  to?: string;
  limit?: number;
}
