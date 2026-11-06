import { z } from 'zod';
import { camelKeys } from '@/shared/lib/case';

/** credentials (design.md 2.5.2). 암호문·nonce 등은 응답에 없다. */
export const credentialRowSchema = z
  .object({
    id: z.string(),
    workspace_id: z.string(),
    provider: z.string(),
    label: z.string(),
    key_version: z.number(),
    purposes: z.array(z.string()),
    created_by: z.string().nullable(),
    created_at: z.string(),
    /** 표시용 확장: 마스킹 미리보기, 사용처, 만료 */
    masked: z.string(),
    used_by: z.array(z.string()),
    expires_at: z.string().nullable(),
    /** 시드에 들어 있는 보기용 키(실제 호출에 쓰지 않음) */
    is_demo: z.boolean().optional(),
    /** 모델 키의 API 주소(프록시·OpenAI 호환 서버). 없으면 제공자 기본 주소 */
    base_url: z.string().nullable().optional(),
    /** 외부 AI(OpenAI 호환 라우터) 키가 제공하는 모델 id. 모델 목록에 이 키 이름으로 나온다 */
    models: z.array(z.string()).optional(),
  })
  ;
export type CredentialRow = z.infer<typeof credentialRowSchema>;
export const toCredential = (r: CredentialRow) => camelKeys(r);
export type Credential = ReturnType<typeof toCredential>;

export const PROVIDERS = [
  { id: 'anthropic', label: 'Anthropic API 키', kind: '모델 키', purposes: ['llm'] },
  { id: 'openai', label: 'OpenAI API 키', kind: '모델 키', purposes: ['llm'] },
  { id: 'google', label: 'Google AI 키', kind: '모델 키', purposes: ['llm'] },
  { id: 'openai_compatible', label: '외부 AI 키 (MonoGPT·OpenRouter 등 OpenAI 호환 라우터)', kind: '모델 키', purposes: ['llm'] },
  { id: 'smtp', label: 'SMTP 메일 계정', kind: 'SMTP', purposes: ['mail'] },
  { id: 'slack', label: 'Slack 봇 토큰', kind: 'MCP 토큰', purposes: ['mcp'] },
  { id: 'notion', label: 'Notion 통합 토큰', kind: 'MCP 토큰', purposes: ['mcp'] },
  { id: 'github', label: 'GitHub 토큰', kind: 'MCP 토큰', purposes: ['mcp'] },
  { id: 'three_d', label: '3D 생성 엔진 키', kind: 'API Key', purposes: ['three_d'] },
] as const;
export const providerInfo = (id: string) => PROVIDERS.find((p) => p.id === id);

/** 모델 키 제공자: API 주소(base URL)를 넣을 수 있다 */
export const LLM_PROVIDERS = ['anthropic', 'openai', 'google', 'openai_compatible'] as const;
export const BASE_URL_HINT: Record<string, string> = {
  anthropic: '비우면 https://api.anthropic.com · 프록시·게이트웨이를 쓸 때만 넣으세요',
  openai: '비우면 https://api.openai.com/v1 · Azure·프록시를 쓸 때 /v1까지 넣으세요',
  google: '비우면 Gemini 기본 주소(OpenAI 호환 엔드포인트)',
  openai_compatible: '필수 · 라우터 문서의 API 주소를 /v1까지 넣으세요. 예: https://openrouter.ai/api/v1',
};

export const credentialFormSchema = z
  .object({
    provider: z.string().min(1, '제공자를 고르세요.'),
    label: z.string().trim().min(1, '이름을 입력하세요.').max(40),
    secret: z.string(),
    base_url: z.string().trim().max(500).optional(),
    models: z.array(z.string()).optional(),
  })
  .superRefine((v, ctx) => {
    const compat = v.provider === 'openai_compatible';
    if (!compat && v.secret.length < 8) ctx.addIssue({ code: 'custom', path: ['secret'], message: '값은 8자 이상입니다.' });
    if (compat && !v.base_url) ctx.addIssue({ code: 'custom', path: ['base_url'], message: 'API 주소를 입력하세요.' });
    if (v.base_url && !/^https?:\/\/[^\s/?#]+/.test(v.base_url)) ctx.addIssue({ code: 'custom', path: ['base_url'], message: 'http:// 또는 https://로 시작하는 주소를 넣으세요.' });
  });
export type CredentialForm = z.infer<typeof credentialFormSchema>;

export interface KnowledgeBaseRow {
  id: string;
  workspace_id: string;
  name: string;
  embed_model: string;
  chunk_size: number;
  chunk_overlap: number;
  created_at: string;
  doc_count: number;
  ready_count: number;
  /** 확장: 색인 실패 문서 수 */
  failed_count?: number;
}

/** GET /models: 모델별로 실제 어떤 키로 도는지. workspace=등록한 키, server=서버 환경 변수 키, demo=키 없음(데모 응답) */
export const modelStatusSchema = z.object({
  id: z.string(),
  label: z.string(),
  family: z.string(),
  context_window: z.number(),
  price_in: z.number(),
  price_out: z.number(),
  /** missing: OpenAI 호환처럼 주소를 등록해야만 쓸 수 있는데 아직 없음(실행하면 오류) */
  source: z.enum(['workspace', 'server', 'demo', 'missing']),
  keyable: z.boolean(),
  credentials: z.array(z.object({ id: z.string(), label: z.string(), masked: z.string(), is_demo: z.boolean().optional(), base_url: z.string().nullable().optional(), models: z.array(z.string()).optional() })),
  default_credential_id: z.string().nullable(),
  max_output: z.number().optional(),
  /** 제공자에게 실제로 보내는 모델 id */
  api_model: z.string().optional(),
  /** 외부 AI 키에 등록한 모델이면 그 키 이름 */
  credential_label: z.string().optional(),
});
export type ModelStatus = z.infer<typeof modelStatusSchema>;
export const familyStatusSchema = modelStatusSchema.pick({ source: true, keyable: true, credentials: true, default_credential_id: true }).extend({ id: z.string(), label: z.string() });
export type FamilyStatus = z.infer<typeof familyStatusSchema>;
export const modelsResponseSchema = z.object({
  items: z.array(modelStatusSchema),
  families: z.array(familyStatusSchema).default([]),
  defaults: z.record(z.string(), z.string()),
});
export type ModelsResponse = z.infer<typeof modelsResponseSchema>;

export const MODEL_SOURCE_LABEL: Record<ModelStatus['source'], string> = {
  workspace: '등록한 키 사용',
  server: '서버 기본 키 사용',
  demo: '키 없음 · 데모 응답',
  missing: '외부 AI 키 미등록 · 실행 불가',
};
export const FAMILY_LABEL: Record<string, string> = { anthropic: 'Anthropic', openai: 'OpenAI', google: 'Google', openai_compatible: '외부 AI', ollama: 'Ollama' };

/** 직접 입력 모델 id: `계열:모델id` (예: openai:gpt-4.1, openai_compatible:qwen2.5-7b) */
export const CUSTOM_MODEL_FAMILIES = ['openai_compatible', 'openai', 'anthropic', 'google', 'ollama'] as const;
export function splitModelId(id: string): { family: string; model: string } | null {
  const i = id.indexOf(':');
  if (i <= 0) return null;
  const family = id.slice(0, i);
  const model = id.slice(i + 1).trim();
  return (CUSTOM_MODEL_FAMILIES as readonly string[]).includes(family) && model ? { family, model } : null;
}

/** 목록 모델이면 그대로, 직접 입력 모델이면 계열 상태로 만든 항목 */
export function findModelStatus(data: Pick<ModelsResponse, 'items' | 'families'> | undefined, modelId: string): ModelStatus | undefined {
  const m = data?.items.find((x) => x.id === modelId);
  if (m) return m;
  const custom = splitModelId(modelId);
  const fam = custom ? data?.families.find((f) => f.id === custom.family) : undefined;
  if (!custom || !fam) return undefined;
  return { ...fam, id: modelId, label: `${custom.model} (${fam.label})`, family: custom.family, context_window: 128_000, price_in: 0, price_out: 0, api_model: custom.model };
}

/** 노드·에이전트의 생성 파라미터(백엔드 GenOptions와 같다) */
export interface ModelParams {
  max_tokens?: number;
  top_p?: number;
  stop?: string[];
  response_format?: 'text' | 'json';
  presence_penalty?: number;
  frequency_penalty?: number;
  seed?: number;
}

export const kbFormSchema = z.object({
  name: z.string().trim().min(1, '이름을 입력하세요.').max(60),
  chunk_size: z.number().int().min(100, '100자 이상').max(4000, '4000자 이하'),
  chunk_overlap: z.number().int().min(0),
}).refine((v) => v.chunk_overlap < v.chunk_size / 2, { message: '겹침은 조각 크기의 절반보다 작아야 합니다.', path: ['chunk_overlap'] });
export type KbForm = z.infer<typeof kbFormSchema>;

export interface KbSearchHit {
  doc: string | null;
  score: number;
  text: string;
}

/** 노드·에이전트 키 선택: "기본 키 사용" 값 */
export const DEFAULT_KEY = '__default__';

/** 모델과 고른 키로 선택지와 "실제로 무엇으로 도는지" 안내를 만든다. */
export function modelKeyInfo(data: Pick<ModelsResponse, 'items' | 'families'> | undefined, modelId: string, credentialId?: string | null) {
  const m = findModelStatus(data, modelId);
  if (!m) return null;
  const def = m.credentials.find((c) => c.id === m.default_credential_id);
  const options = [
    { value: DEFAULT_KEY, label: def ? `워크스페이스 기본 키 (${def.label})` : '워크스페이스 기본 키' },
    ...m.credentials.map((c) => ({ value: c.id, label: `${c.label} · ${c.base_url ? hostOf(c.base_url) : c.masked}${c.is_demo ? ' · 보기용' : ''}` })),
  ];
  const chosen = credentialId ? m.credentials.find((c) => c.id === credentialId) : undefined;
  let tone: 'ok' | 'warn' | 'error' = 'ok';
  let text: string;
  if (credentialId && !chosen) {
    tone = 'error';
    text = '지정한 키가 지워졌거나 이 모델용이 아닙니다. 실행하면 자격증명 오류로 실패합니다.';
  } else if (chosen) {
    tone = chosen.is_demo ? 'warn' : 'ok';
    text = chosen.is_demo ? '보기용 키라 실제 모델 대신 데모 응답이 나옵니다.' : `'${chosen.label}' 키로 실행합니다.`;
  } else if (!m.keyable) {
    tone = m.source === 'demo' ? 'warn' : 'ok';
    text = m.source === 'demo' ? '로컬 모델 서버(OLLAMA_BASE_URL)가 설정되지 않아 데모 응답이 나옵니다.' : '로컬 모델 서버로 실행합니다.';
  } else if (m.source === 'workspace' && def && !def.is_demo) {
    text = `워크스페이스 기본 키(${def.label})로 실행합니다.`;
  } else if (m.source === 'missing') {
    tone = 'error';
    text = '외부 AI 키가 등록되지 않아 실행하면 실패합니다. 연동 > 모델 키에서 외부 AI 키를 추가하세요.';
  } else if (m.source === 'server') {
    text = '서버에 설정된 기본 키로 실행합니다.';
  } else {
    tone = 'warn';
    text = `${FAMILY_LABEL[m.family] ?? m.family} 키가 없어 데모 응답이 나옵니다. 연동 > 모델 키에서 키를 추가하세요.`;
  }
  return { model: m, options, value: chosen || (credentialId && !chosen) ? credentialId! : DEFAULT_KEY, tone, text };
}

/** 쉼표·줄바꿈으로 적은 모델 id를 목록으로(공백·중복 제거) */
export function parseModelIds(text: string): string[] {
  return [...new Set(text.split(/[,\n]/).map((x) => x.trim()).filter(Boolean))];
}

/** 모델 고르기 목록: 기본 모델 + 외부 AI 키에 등록한 모델("모델id · 키 이름") */
export function modelPresets(base: readonly { value: string; label: string }[], data: Pick<ModelsResponse, 'items'> | undefined) {
  const ext = (data?.items ?? [])
    .filter((m) => m.credential_label && !base.some((b) => b.value === m.id))
    .map((m) => ({ value: m.id, label: `${m.label} · ${m.credential_label}` }));
  return [...base, ...ext];
}

/** 외부 AI 키에 등록한 모델이면 그 키 id(모델을 고르면 키도 같이 고른다) */
export function boundCredential(data: Pick<ModelsResponse, 'items'> | undefined, modelId: string): string | null {
  const m = data?.items.find((x) => x.id === modelId);
  return m?.credential_label ? m.default_credential_id : null;
}

export function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}
