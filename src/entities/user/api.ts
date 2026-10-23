import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/lib/api-client';
import { toUser, userRowSchema, type LoginInput, type SignupInput } from './model';

const meSchema = userRowSchema;

export const userKeys = { me: ['me'] as const };

export async function fetchMe() {
  const r = await api.get<{ user: unknown }>('/auth/me');
  return meSchema.parse(r.user);
}

export function useMe(opts: { enabled?: boolean } = {}) {
  return useQuery({ queryKey: userKeys.me, queryFn: fetchMe, select: toUser, retry: false, staleTime: 60_000, ...opts });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: LoginInput) => api.post<{ user: unknown }>('/auth/login', input),
    onSuccess: async () => {
      qc.clear();
      await qc.invalidateQueries({ queryKey: userKeys.me });
    },
  });
}

export function useSignup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ password_confirm: _c, ...input }: SignupInput) => api.post<{ user: unknown }>('/auth/signup', input),
    onSuccess: () => qc.clear(),
  });
}

export function useOAuthLogin() {
  const qc = useQueryClient();
  return useMutation({
    // 목: 제공자 화면 없이 바로 콜백을 호출한다(PKCE 흐름은 실제 백엔드에서)
    mutationFn: (provider: 'google' | 'github') => api.get<{ user: unknown }>(`/auth/oauth/${provider}/callback`, { query: { code: 'mock', state: 'mock' } }),
    onSuccess: () => qc.clear(),
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post('/auth/logout'),
    onSuccess: () => qc.clear(),
  });
}
