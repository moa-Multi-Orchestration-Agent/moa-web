import { z } from 'zod';
import { camelKeys } from '@/shared/lib/case';

/** 포트 자료형(JSON Schema 부분집합 + image) */
export const PORT_TYPES = ['string', 'number', 'integer', 'boolean', 'object', 'array', 'image', 'any'] as const;
export const portTypeSchema = z.enum(PORT_TYPES);
export type PortType = z.infer<typeof portTypeSchema>;

export const portSchema = z.object({
  name: z.string(),
  type: portTypeSchema,
  required: z.boolean().optional(),
  label: z.string().optional(),
  description: z.string().optional(),
});
export type Port = z.infer<typeof portSchema>;

/** design.md 2.2.3 HANDLERS + 2.2.1 compile의 parallel·loop */
export const NODE_TYPES = [
  'input',
  'output',
  'llm',
  'tool',
  'http',
  'code',
  'condition',
  'loop',
  'parallel',
  'kb_search',
  'three_d',
  'approval',
] as const;
export const nodeTypeSchema = z.enum(NODE_TYPES);
export type NodeType = z.infer<typeof nodeTypeSchema>;

export const retryPolicySchema = z.object({
  max_attempts: z.number().int().min(1).max(10).default(3),
  base_delay: z.number().optional(),
  max_delay: z.number().optional(),
});

/** NodeDef (design.md 2.2.1) + 편집기 표시용 name·block·position */
export const nodeDefSchema = z
  .object({
    id: z.string(),
    type: nodeTypeSchema,
    block: z.string().optional(),
    name: z.string(),
    config: z.record(z.unknown()).default({}),
    ports_in: z.array(portSchema).default([]),
    ports_out: z.array(portSchema).default([]),
    retry: retryPolicySchema.optional(),
    timeout_s: z.number().optional(),
    position: z.object({ x: z.number(), y: z.number() }).optional(),
  })
  ;
export type NodeDef = z.infer<typeof nodeDefSchema>;

export const edgeDefSchema = z
  .object({
    id: z.string().optional(),
    source: z.string(),
    source_port: z.string(),
    target: z.string(),
    target_port: z.string(),
    condition: z.string().nullable().optional(),
  })
  ;
export type EdgeDef = z.infer<typeof edgeDefSchema>;

export const definitionSchema = z
  .object({
    nodes: z.array(nodeDefSchema),
    edges: z.array(edgeDefSchema),
    inputs_schema: z.record(z.unknown()).optional(),
  })
  ;
export type WorkflowDefinition = z.infer<typeof definitionSchema>;

export const validationIssueSchema = z.object({
  code: z.string(),
  node_id: z.string().nullable(),
  port: z.string().nullable().optional(),
  message: z.string(),
  severity: z.enum(['error', 'warn']),
});
export type ValidationIssue = z.infer<typeof validationIssueSchema>;

export const WORKFLOW_TRIGGERS = ['agent', 'api', 'schedule', 'webhook', 'mail', 'manual'] as const;
export type WorkflowTrigger = (typeof WORKFLOW_TRIGGERS)[number];

export const workflowRowSchema = z
  .object({
    id: z.string(),
    workspace_id: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    draft_version: z.number(),
    origin_version_id: z.string().nullable(),
    created_by: z.string().nullable(),
    created_at: z.string(),
    updated_at: z.string(),
    deleted_at: z.string().nullable(),
    /** 목록 집계 필드(frontend-plan D28) */
    node_count: z.number(),
    trigger: z.string(),
    agents: z.array(z.object({ id: z.string(), name: z.string() })),
    latest_version: z.number().nullable(),
    last_run_at: z.string().nullable(),
    run_count: z.number(),
    deployed: z.boolean(),
    listed: z.boolean(),
    mini: z.array(z.string()).optional(),
  })
  ;
export type WorkflowRow = z.infer<typeof workflowRowSchema>;
export const toWorkflow = (r: WorkflowRow) => camelKeys(r);
export type Workflow = ReturnType<typeof toWorkflow>;

export const workflowDetailSchema = workflowRowSchema.extend({ draft: definitionSchema });
export type WorkflowDetailRow = z.infer<typeof workflowDetailSchema>;

export const workflowVersionRowSchema = z
  .object({
    id: z.string(),
    workflow_id: z.string(),
    version: z.number(),
    definition: definitionSchema.optional(),
    def_hash: z.string(),
    note: z.string().nullable(),
    created_by: z.string().nullable(),
    created_at: z.string(),
  })
  ;
export type WorkflowVersionRow = z.infer<typeof workflowVersionRowSchema>;

export const draftSaveResponseSchema = z.object({
  draft_version: z.number(),
  issues: z.array(validationIssueSchema),
});
export type DraftSaveResponse = z.infer<typeof draftSaveResponseSchema>;

/** 노드 팔레트 블록 */
export const blockSchema = z
  .object({
    id: z.string(),
    group: z.string(),
    type: nodeTypeSchema,
    label: z.string(),
    description: z.string(),
    icon: z.string(),
    config: z.record(z.unknown()).default({}),
    ports_in: z.array(portSchema),
    ports_out: z.array(portSchema),
    async: z.boolean().optional(),
  })
  ;
export type Block = z.infer<typeof blockSchema>;

export const nodeCatalogSchema = z.object({
  groups: z.array(z.object({ id: z.string(), label: z.string() })),
  blocks: z.array(blockSchema),
});
export type NodeCatalog = z.infer<typeof nodeCatalogSchema>;

export const workflowCreateSchema = z.object({
  name: z.string().trim().min(1, '이름을 입력하세요.').max(80, '80자 이하로 입력하세요.'),
  description: z.string().max(200).optional(),
});
export type WorkflowCreateInput = z.infer<typeof workflowCreateSchema> & { draft?: WorkflowDefinition };

export const TRIGGER_LABEL: Record<string, string> = {
  agent: '에이전트 호출',
  api: 'API 호출',
  schedule: '예약',
  webhook: 'Webhook',
  mail: '메일 수신',
  manual: '수동 실행',
};
