import { z } from 'zod';
import { camelKeys } from '@/shared/lib/case';

/** api_keys (design.md 2.5.2). hash는 응답에 없다. */
export const apiKeyRowSchema = z
  .object({
    id: z.string(),
    workspace_id: z.string(),
    name: z.string(),
    prefix: z.string(),
    scopes: z.array(z.string()),
    last_used_at: z.string().nullable(),
    expires_at: z.string().nullable(),
    revoked_at: z.string().nullable(),
    created_by: z.string().nullable(),
    created_at: z.string(),
  })
  ;
export type ApiKeyRow = z.infer<typeof apiKeyRowSchema>;
export const toApiKey = (r: ApiKeyRow) => camelKeys(r);
export type ApiKey = ReturnType<typeof toApiKey>;

/** 발급 응답: 평문 키는 이 응답에만 있다(2.3.3) */
export const issuedKeySchema = apiKeyRowSchema.extend({ key: z.string() });
export type IssuedKey = z.infer<typeof issuedKeySchema>;

export const apiKeyFormSchema = z.object({
  name: z.string().trim().min(1, '이름을 입력하세요.').max(40),
  expires_in_days: z.enum(['30', '90', '365', 'never']),
});
export type ApiKeyForm = z.infer<typeof apiKeyFormSchema>;

export const maskKey = (prefix: string) => `moa_live_${prefix}_••••`;
