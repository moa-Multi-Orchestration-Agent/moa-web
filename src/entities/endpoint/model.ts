import { z } from 'zod';
import { camelKeys } from '@/shared/lib/case';

export const SLUG_RE = /^[a-z0-9][a-z0-9-]{2,62}$/;
export const RESERVED_SLUGS = ['api', 'admin', 'docs', 'health', 'openapi'];
/** 배포 API 주소(화면 표시용). 실제 백엔드에 붙일 때는 백엔드의 MOA_PUBLIC_API_ORIGIN과 같게 맞춘다. */
export const PUBLIC_API_ORIGIN = (process.env.NEXT_PUBLIC_PUBLIC_API_ORIGIN || 'https://api.moa.dev').replace(/\/$/, '');

export const endpointRowSchema = z
  .object({
    id: z.string(),
    workspace_id: z.string(),
    slug: z.string(),
    /** 워크플로만 배포했으면 null */
    agent_id: z.string().nullable(),
    /** 배포된 워크플로(에이전트 배포면 기본 워크플로) */
    workflow_id: z.string().nullable().optional(),
    target: z.enum(['agent', 'workflow']).optional(),
    workflow_version_id: z.string(),
    mode: z.enum(['sync', 'async']),
    input_schema: z.record(z.unknown()),
    webhook_url: z.string().nullable(),
    rate_limit_rpm: z.number(),
    is_active: z.boolean(),
    created_at: z.string(),
    updated_at: z.string(),
    /** 표시용 확장(워크플로 배포면 워크플로 이름) */
    agent_name: z.string(),
    workspace_slug: z.string(),
    version: z.number(),
    call_count_7d: z.number(),
    url: z.string(),
    /** 상세 응답에만 */
    webhook_secret: z.string().optional(),
  })
  ;
export type EndpointRow = z.infer<typeof endpointRowSchema>;
export const toEndpoint = (r: EndpointRow) => camelKeys(r);
export type Endpoint = ReturnType<typeof toEndpoint>;

export const endpointFormSchema = z
  .object({
  target: z.enum(['agent', 'workflow']),
  agent_id: z.string(),
  workflow_id: z.string(),
  slug: z
    .string()
    .regex(SLUG_RE, '소문자·숫자·하이픈 3~63자, 첫 글자는 영문 소문자나 숫자')
    .refine((s) => !RESERVED_SLUGS.includes(s), '예약된 이름이라 쓸 수 없습니다.'),
  mode: z.enum(['sync', 'async']),
  webhook_url: z.union([z.literal(''), z.string().url('URL 형식이 아닙니다.')]),
  rate_limit_rpm: z.number().int().min(1, '1 이상').max(6000, '6000 이하'),
  })
  .superRefine((f, ctx) => {
    if (f.target === 'agent' && !f.agent_id) ctx.addIssue({ code: 'custom', path: ['agent_id'], message: '에이전트를 고르세요.' });
    if (f.target === 'workflow' && !f.workflow_id) ctx.addIssue({ code: 'custom', path: ['workflow_id'], message: '워크플로를 고르세요.' });
  });
export type EndpointForm = z.infer<typeof endpointFormSchema>;

/** POST /endpoints 본문: 고른 대상(에이전트 또는 워크플로)의 id만 보낸다 */
export function endpointBody({ target, agent_id, workflow_id, ...rest }: EndpointForm) {
  return { ...rest, webhook_url: rest.webhook_url || null, ...(target === 'agent' ? { agent_id } : { workflow_id }) };
}

/** 이 워크플로를 배포한 엔드포인트(워크플로 직접 배포 + 이 워크플로를 기본으로 쓰는 에이전트 배포) */
export function endpointsOfWorkflow(list: Endpoint[], wf: { id: string; agents: { id: string }[] }): Endpoint[] {
  const agentIds = new Set(wf.agents.map((a) => a.id));
  return list.filter((e) => (e.workflowId ? e.workflowId === wf.id : !!e.agentId && agentIds.has(e.agentId)));
}

export interface EndpointStat {
  date: string;
  calls: number;
  errors: number;
  p50_ms: number;
}

export interface WebhookDelivery {
  id: string;
  endpoint_id: string;
  run_id: string;
  status_code: number;
  ok: boolean;
  attempt: number;
  event: string;
  created_at: string;
  payload: Record<string, unknown>;
}

export interface InvokeResult {
  status: number;
  headers: Record<string, string>;
  body: unknown;
  ms: number;
}
