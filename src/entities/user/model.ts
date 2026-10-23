import { z } from 'zod';
import { camelKeys } from '@/shared/lib/case';

/** users (design.md 2.5.2). password_hash 등 비밀 필드는 응답에 없다. */
export const userRowSchema = z
  .object({
    id: z.string(),
    email: z.string(),
    display_name: z.string(),
    oauth_provider: z.string().nullable().optional(),
    created_at: z.string(),
    updated_at: z.string().optional(),
  })
  ;
export type UserRow = z.infer<typeof userRowSchema>;
export const toUser = (r: UserRow) => camelKeys(r);
export type User = ReturnType<typeof toUser>;

export const loginInputSchema = z.object({
  email: z.string().min(1, '이메일을 입력하세요.').email('이메일 형식이 아닙니다.'),
  password: z.string().min(8, '비밀번호는 8자 이상입니다.'),
});
export type LoginInput = z.infer<typeof loginInputSchema>;

export const signupInputSchema = loginInputSchema
  .extend({
    display_name: z.string().trim().min(2, '이름은 2자 이상입니다.').max(30, '이름은 30자 이하입니다.'),
    password_confirm: z.string(),
  })
  .refine((v) => v.password === v.password_confirm, {
    message: '비밀번호가 서로 다릅니다.',
    path: ['password_confirm'],
  });
export type SignupInput = z.infer<typeof signupInputSchema>;
