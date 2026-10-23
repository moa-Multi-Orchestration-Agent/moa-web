import { z } from 'zod';
import { camelKeys } from '@/shared/lib/case';
import { definitionSchema } from '../workflow/model';

export const TEMPLATE_CATEGORIES = [
  { id: 'content', label: '콘텐츠' },
  { id: 'research', label: '리서치' },
  { id: 'support', label: '고객지원' },
  { id: 'data', label: '데이터' },
  { id: 'dev', label: '개발' },
  { id: 'marketing', label: '마케팅' },
  { id: 'design3d', label: '3D·디자인' },
  { id: 'automation', label: '업무자동화' },
] as const;
export const categoryLabel = (id: string) => TEMPLATE_CATEGORIES.find((c) => c.id === id)?.label ?? id;

export const DIFFICULTY_LABEL: Record<string, string> = { easy: '쉬움', medium: '보통', hard: '어려움' };

export const requiredConnectionSchema = z.object({
  kind: z.enum(['credential', 'mcp', 'kb']),
  provider: z.string(),
  label: z.string(),
});
export type RequiredConnection = z.infer<typeof requiredConnectionSchema>;

export const templateRowSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    summary: z.string(),
    category: z.string(),
    kind: z.enum(['agent', 'workflow']),
    difficulty: z.enum(['easy', 'medium', 'hard']),
    icon: z.string(),
    node_count: z.number(),
    trigger: z.string(),
    model: z.string().nullable(),
    skills: z.array(z.string()),
    required_connections: z.array(requiredConnectionSchema),
    official: z.boolean(),
  })
  ;
export type TemplateRow = z.infer<typeof templateRowSchema>;
export const toTemplate = (r: TemplateRow) => camelKeys(r);
export type Template = ReturnType<typeof toTemplate>;

export const templateDetailSchema = templateRowSchema.extend({
  description: z.string(),
  definition: definitionSchema,
  /** 연결 상태 판정(현재 워크스페이스 기준) */
  connections: z.array(requiredConnectionSchema.extend({ connected: z.boolean() })),
});
export type TemplateDetailRow = z.infer<typeof templateDetailSchema>;

/** TemplateInstantiator.clone 결과 (design.md 2.4.4) */
export const cloneResultSchema = z.object({
  agent_id: z.string().nullable(),
  workflow_id: z.string(),
  missing: z.array(requiredConnectionSchema),
});
export type CloneResult = z.infer<typeof cloneResultSchema>;
