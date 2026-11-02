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
  })
  ;
export type CredentialRow = z.infer<typeof credentialRowSchema>;
export const toCredential = (r: CredentialRow) => camelKeys(r);
export type Credential = ReturnType<typeof toCredential>;

export const PROVIDERS = [
  { id: 'anthropic', label: 'Anthropic API 키', kind: '모델 키', purposes: ['llm'] },
  { id: 'openai', label: 'OpenAI API 키', kind: '모델 키', purposes: ['llm'] },
  { id: 'google', label: 'Google AI 키', kind: '모델 키', purposes: ['llm'] },
  { id: 'smtp', label: 'SMTP 메일 계정', kind: 'SMTP', purposes: ['mail'] },
  { id: 'slack', label: 'Slack 봇 토큰', kind: 'MCP 토큰', purposes: ['mcp'] },
  { id: 'notion', label: 'Notion 통합 토큰', kind: 'MCP 토큰', purposes: ['mcp'] },
  { id: 'github', label: 'GitHub 토큰', kind: 'MCP 토큰', purposes: ['mcp'] },
  { id: 'three_d', label: '3D 생성 엔진 키', kind: 'API Key', purposes: ['three_d'] },
] as const;
export const providerInfo = (id: string) => PROVIDERS.find((p) => p.id === id);

export const credentialFormSchema = z.object({
  provider: z.string().min(1, '제공자를 고르세요.'),
  label: z.string().trim().min(1, '이름을 입력하세요.').max(40),
  secret: z.string().min(8, '값은 8자 이상입니다.'),
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
  source: z.enum(['workspace', 'server', 'demo']),
  keyable: z.boolean(),
  credentials: z.array(z.object({ id: z.string(), label: z.string(), masked: z.string(), is_demo: z.boolean().optional() })),
  default_credential_id: z.string().nullable(),
});
export type ModelStatus = z.infer<typeof modelStatusSchema>;
export const modelsResponseSchema = z.object({ items: z.array(modelStatusSchema), defaults: z.record(z.string(), z.string()) });

export const MODEL_SOURCE_LABEL: Record<ModelStatus['source'], string> = {
  workspace: '등록한 키 사용',
  server: '서버 기본 키 사용',
  demo: '키 없음 · 데모 응답',
};
export const FAMILY_LABEL: Record<string, string> = { anthropic: 'Anthropic', openai: 'OpenAI', google: 'Google', ollama: 'Ollama' };

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
export function modelKeyInfo(models: ModelStatus[] | undefined, modelId: string, credentialId?: string | null) {
  const m = models?.find((x) => x.id === modelId);
  if (!m) return null;
  const def = m.credentials.find((c) => c.id === m.default_credential_id);
  const options = [
    { value: DEFAULT_KEY, label: def ? `워크스페이스 기본 키 (${def.label})` : '워크스페이스 기본 키' },
    ...m.credentials.map((c) => ({ value: c.id, label: `${c.label} · ${c.masked}${c.is_demo ? ' · 보기용' : ''}` })),
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
  } else if (m.source === 'server') {
    text = '서버에 설정된 기본 키로 실행합니다.';
  } else {
    tone = 'warn';
    text = `${FAMILY_LABEL[m.family] ?? m.family} 키가 없어 데모 응답이 나옵니다. 연동 > 모델 키에서 키를 추가하세요.`;
  }
  return { model: m, options, value: chosen || (credentialId && !chosen) ? credentialId! : DEFAULT_KEY, tone, text };
}
