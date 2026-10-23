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
