import { z } from 'zod';

export const BLOCK_ROLES = ['system', 'memory', 'knowledge', 'tool', 'history', 'user', 'summary'] as const;
export type BlockRole = (typeof BLOCK_ROLES)[number];

export const ROLE_LABEL: Record<BlockRole, string> = {
  system: '시스템',
  memory: '기억',
  knowledge: '지식',
  tool: '도구',
  history: '응답',
  user: '사용자',
  summary: '요약',
};

/** context_blocks (design.md 1.4.3) */
export const contextBlockRowSchema = z
  .object({
    id: z.string(),
    session_id: z.string(),
    seq: z.number(),
    role: z.enum(BLOCK_ROLES),
    content: z.string(),
    token_count: z.number(),
    pinned: z.boolean(),
    enabled: z.boolean(),
    priority: z.number(),
    source_node: z.string().nullable(),
    compressed_into: z.string().nullable(),
    expires_at: z.string().nullable(),
    version: z.number(),
    created_at: z.string(),
    updated_at: z.string(),
  })
  ;
export type ContextBlockRow = z.infer<typeof contextBlockRowSchema>;

export const contextSessionRowSchema = z
  .object({
    id: z.string(),
    workspace_id: z.string(),
    agent_id: z.string().nullable(),
    run_id: z.string().nullable(),
    model_family: z.string(),
    last_seq: z.number(),
    used_tokens: z.number(),
    created_at: z.string(),
    /** 표시용 확장: 예산과 임계치 */
    budget_tokens: z.number(),
    compress_threshold: z.number(),
    compressions: z
      .array(z.object({ summary_block_id: z.string().nullable(), source_block_ids: z.array(z.string()), saved_tokens: z.number(), strategy: z.string(), created_at: z.string() }))
      .default([]),
  })
  ;
export type ContextSessionRow = z.infer<typeof contextSessionRowSchema>;

export const snapshotRowSchema = z.object({
  id: z.string(),
  session_id: z.string(),
  label: z.string(),
  block_count: z.number(),
  s3_key: z.string().nullable(),
  created_at: z.string(),
});
export type SnapshotRow = z.infer<typeof snapshotRowSchema>;

export interface BlockPatch {
  pinned?: boolean;
  enabled?: boolean;
  priority?: number;
  content?: string;
}
