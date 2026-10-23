import { z } from 'zod';
import { camelKeys } from '@/shared/lib/case';

export const MODELS = [
  { id: 'claude-sonnet-4', label: 'Claude Sonnet', family: 'anthropic', context: 200_000, price_in: 3, price_out: 15 },
  { id: 'claude-haiku-4', label: 'Claude Haiku', family: 'anthropic', context: 200_000, price_in: 0.8, price_out: 4 },
  { id: 'claude-opus-4', label: 'Claude Opus', family: 'anthropic', context: 200_000, price_in: 15, price_out: 75 },
  { id: 'gpt-4o', label: 'GPT-4o', family: 'openai', context: 128_000, price_in: 2.5, price_out: 10 },
  { id: 'gpt-4o-mini', label: 'GPT-4o mini', family: 'openai', context: 128_000, price_in: 0.15, price_out: 0.6 },
  { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', family: 'google', context: 1_000_000, price_in: 0.1, price_out: 0.4 },
  { id: 'llama3.1-8b', label: 'Llama 3.1 8B (Ollama)', family: 'ollama', context: 8_000, price_in: 0, price_out: 0 },
] as const;
export type ModelId = (typeof MODELS)[number]['id'];
export const modelLabel = (id: string | null | undefined) => MODELS.find((m) => m.id === id)?.label ?? id ?? '—';

/** 내장 스킬 (agent_skills.builtin_skill) */
export const BUILTIN_SKILLS = [
  { id: 'web_search', label: '웹 검색', kind: '기본', description: '검색 엔진으로 최신 정보를 찾습니다', destructive: false },
  { id: 'kb_search', label: 'RAG 검색', kind: '지식', description: '연결한 지식베이스에서 근거를 찾습니다', destructive: false },
  { id: 'memory_save', label: '기억하기', kind: '기본', description: "'기억해줘' 요청을 장기 기억에 저장합니다", destructive: false },
  { id: 'mail_send', label: '메일 보내기', kind: '기본', description: '팀 메일 계정으로 발송 · 승인 단계 설정 가능', destructive: true },
  { id: 'three_d', label: '2D → 3D 변환', kind: '도구', description: '이미지를 3D 메시로 변환 · 비동기 실행', destructive: false },
  { id: 'code_exec', label: '코드 실행', kind: '도구', description: '샌드박스에서 Python을 실행합니다', destructive: false },
] as const;
export const builtinSkill = (id: string | null | undefined) => BUILTIN_SKILLS.find((s) => s.id === id);

export const agentSkillRowSchema = z
  .object({
    id: z.string(),
    agent_id: z.string(),
    mcp_tool_id: z.string().nullable(),
    builtin_skill: z.string().nullable(),
    require_approval: z.boolean(),
    config: z.record(z.unknown()),
    /** 표시용 확장: 도구 이름·서버·destructive */
    label: z.string().optional(),
    description: z.string().optional(),
    server_name: z.string().nullable().optional(),
    destructive: z.boolean().optional(),
  })
  ;
export type AgentSkillRow = z.infer<typeof agentSkillRowSchema>;

export const agentWorkflowRowSchema = z.object({
  workflow_id: z.string(),
  alias: z.string(),
  name: z.string().optional(),
  io_summary: z.string().optional(),
});
export type AgentWorkflowRow = z.infer<typeof agentWorkflowRowSchema>;

export const agentRowSchema = z
  .object({
    id: z.string(),
    workspace_id: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    model: z.string(),
    fallback_models: z.array(z.string()),
    system_prompt: z.string(),
    temperature: z.number(),
    memory_enabled: z.boolean(),
    primary_workflow_id: z.string().nullable(),
    created_by: z.string().nullable(),
    created_at: z.string(),
    updated_at: z.string(),
    deleted_at: z.string().nullable(),
    /** 확장(frontend-plan D7·D28) */
    icon: z.string().nullable().optional(),
    memory_scopes: z.array(z.string()).optional(),
    skill_count: z.number(),
    workflow_count: z.number(),
    skill_names: z.array(z.string()),
    workflow_names: z.array(z.string()),
    endpoint_count: z.number(),
    endpoint_slugs: z.array(z.string()),
    run_count: z.number(),
    last_run_at: z.string().nullable(),
    listed: z.boolean(),
    purchased: z.boolean(),
    api_only: z.boolean(),
    latest_version: z.number().nullable(),
  })
  ;
export type AgentRow = z.infer<typeof agentRowSchema>;

export const agentDetailSchema = agentRowSchema.extend({
  skills: z.array(agentSkillRowSchema),
  workflows: z.array(agentWorkflowRowSchema),
});
export type AgentDetailRow = z.infer<typeof agentDetailSchema>;

export const toAgent = (r: AgentRow) => camelKeys(r);
export type Agent = ReturnType<typeof toAgent>;

/** 에이전트 빌더 폼 (snake_case: PATCH 본문과 같다) */
export const agentFormSchema = z.object({
  name: z.string().trim().min(1, '이름을 입력하세요.').max(60, '60자 이하로 입력하세요.'),
  description: z.string().max(200, '200자 이하로 입력하세요.').nullable(),
  icon: z.string().nullable(),
  model: z.string().min(1, '모델을 고르세요.'),
  fallback_models: z.array(z.string()),
  temperature: z.number().min(0).max(2),
  system_prompt: z.string().max(20_000, '2만 자 이하로 입력하세요.'),
  memory_enabled: z.boolean(),
  memory_scopes: z.array(z.string()),
});
export type AgentForm = z.infer<typeof agentFormSchema>;

export const AGENT_ICONS = ['🤖', '🔎', '📚', '💬', '🧭', '🎨', '📰', '📝', '🛠️', '📊'] as const;
