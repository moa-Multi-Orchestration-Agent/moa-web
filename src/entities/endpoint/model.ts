import { z } from 'zod';
import { camelKeys } from '@/shared/lib/case';

export const SLUG_RE = /^[a-z0-9][a-z0-9-]{2,62}$/;
export const RESERVED_SLUGS = ['api', 'admin', 'docs', 'health', 'openapi'];
export const PUBLIC_API_ORIGIN = 'https://api.moa.dev';

export const endpointRowSchema = z
  .object({
    id: z.string(),
    workspace_id: z.string(),
    slug: z.string(),
    agent_id: z.string(),
    workflow_version_id: z.string(),
    mode: z.enum(['sync', 'async']),
    input_schema: z.record(z.unknown()),
    webhook_url: z.string().nullable(),
    rate_limit_rpm: z.number(),
    is_active: z.boolean(),
    created_at: z.string(),
    updated_at: z.string(),
    /** 표시용 확장 */
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

export const endpointFormSchema = z.object({
  agent_id: z.string().min(1, '에이전트를 고르세요.'),
  slug: z
    .string()
    .regex(SLUG_RE, '소문자·숫자·하이픈 3~63자, 첫 글자는 영문 소문자나 숫자')
    .refine((s) => !RESERVED_SLUGS.includes(s), '예약된 이름이라 쓸 수 없습니다.'),
  mode: z.enum(['sync', 'async']),
  webhook_url: z.union([z.literal(''), z.string().url('URL 형식이 아닙니다.')]),
  rate_limit_rpm: z.number().int().min(1, '1 이상').max(6000, '6000 이하'),
});
export type EndpointForm = z.infer<typeof endpointFormSchema>;

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
