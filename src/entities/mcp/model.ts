import { z } from 'zod';
import { camelKeys } from '@/shared/lib/case';

export const mcpServerRowSchema = z
  .object({
    id: z.string(),
    workspace_id: z.string(),
    name: z.string(),
    transport: z.enum(['stdio', 'sse', 'http']),
    command: z.string().nullable(),
    url: z.string().nullable(),
    credential_id: z.string().nullable(),
    allow_tools: z.array(z.string()).nullable(),
    is_active: z.boolean(),
    last_synced_at: z.string().nullable(),
    created_at: z.string(),
    /** 표시용 확장 */
    status: z.enum(['connected', 'error', 'syncing']),
    tool_count: z.number(),
    icon: z.string(),
    auth: z.enum(['none', 'token', 'oauth']).optional(),
  })
  ;
export type McpServerRow = z.infer<typeof mcpServerRowSchema>;
export const toMcpServer = (r: McpServerRow) => camelKeys(r);
export type McpServer = ReturnType<typeof toMcpServer>;

export const mcpToolRowSchema = z
  .object({
    id: z.string(),
    server_id: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    input_schema: z.record(z.unknown()),
    output_schema: z.record(z.unknown()).nullable(),
    annotations: z
      .object({ title: z.string().optional(), readOnlyHint: z.boolean().optional(), destructiveHint: z.boolean().optional(), idempotentHint: z.boolean().optional() })
      ,
    is_active: z.boolean(),
    synced_at: z.string(),
    server_name: z.string(),
  })
  ;
export type McpToolRow = z.infer<typeof mcpToolRowSchema>;

export const mcpServerFormSchema = z
  .object({
    name: z.string().trim().min(1, '이름을 입력하세요.').max(40),
    transport: z.enum(['stdio', 'sse', 'http']),
    command: z.string(),
    url: z.string(),
    credential_id: z.string().nullable(),
  })
  .superRefine((v, ctx) => {
    if (v.transport === 'stdio' && !v.command.trim()) ctx.addIssue({ code: 'custom', path: ['command'], message: '실행 명령을 입력하세요.' });
    if (v.transport !== 'stdio' && !/^https?:\/\//.test(v.url)) ctx.addIssue({ code: 'custom', path: ['url'], message: 'http(s):// 로 시작하는 URL을 입력하세요.' });
  });
export type McpServerForm = z.infer<typeof mcpServerFormSchema>;

export const TRANSPORT_LABEL: Record<string, string> = { stdio: 'stdio (로컬 명령)', sse: 'SSE', http: 'Streamable HTTP' };
