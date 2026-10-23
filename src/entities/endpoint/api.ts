import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Page } from '@/shared/lib/api-client';
import { patchEverywhere, restore, wsKey } from '@/shared/lib/query';
import { endpointRowSchema, toEndpoint, type EndpointForm, type EndpointRow, type EndpointStat, type InvokeResult, type WebhookDelivery } from './model';

export const endpointKeys = {
  all: ['endpoints'] as const,
  list: () => ['endpoints', wsKey(), 'list'] as const,
  detail: (id: string) => ['endpoints', wsKey(), 'detail', id] as const,
  stats: (id: string, days: number) => ['endpoints', wsKey(), 'stats', id, days] as const,
  deliveries: (id: string) => ['endpoints', wsKey(), 'deliveries', id] as const,
  openapi: (id: string) => ['endpoints', wsKey(), 'openapi', id] as const,
  slug: (slug: string) => ['endpoints', wsKey(), 'slug', slug] as const,
};

export function useEndpoints() {
  return useQuery({
    queryKey: endpointKeys.list(),
    queryFn: async () => endpointRowSchema.array().parse((await api.get<Page<unknown>>('/endpoints')).items),
    select: (rows) => rows.map(toEndpoint),
  });
}

export function useEndpoint(id: string | null | undefined) {
  return useQuery({
    queryKey: endpointKeys.detail(id ?? '_'),
    queryFn: async () => endpointRowSchema.parse(await api.get(`/endpoints/${id}`)),
    select: toEndpoint,
    enabled: !!id,
  });
}

export function useCreateEndpoint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: EndpointForm) => api.post<EndpointRow>('/endpoints', { ...input, webhook_url: input.webhook_url || null }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: endpointKeys.all });
      void qc.invalidateQueries({ queryKey: ['agents'] });
    },
  });
}

export function useUpdateEndpoint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: Partial<Omit<EndpointRow, 'id'>> & { id: string; redeploy?: boolean }) => api.patch<EndpointRow>(`/endpoints/${id}`, patch),
    onMutate: async ({ id, redeploy: _r, ...patch }) => {
      await qc.cancelQueries({ queryKey: endpointKeys.all });
      return { snap: patchEverywhere<EndpointRow>(qc, endpointKeys.all, id, (e) => ({ ...e, ...patch })) };
    },
    onError: (_e, _v, ctx) => restore(qc, ctx?.snap),
    onSettled: () => qc.invalidateQueries({ queryKey: endpointKeys.all }),
  });
}

/** slug 사용 가능 여부(형식은 폼에서, 중복은 서버에서) */
export function useCheckSlug(slug: string, enabled: boolean) {
  return useQuery({
    queryKey: endpointKeys.slug(slug),
    queryFn: () => api.get<{ available: boolean; reason: 'format' | 'reserved' | 'taken' | null }>('/endpoints/check-slug', { query: { slug } }),
    enabled: enabled && slug.length >= 3,
    staleTime: 5_000,
  });
}

export function useEndpointStats(id: string, days = 7) {
  return useQuery({ queryKey: endpointKeys.stats(id, days), queryFn: async () => (await api.get<{ items: EndpointStat[] }>(`/endpoints/${id}/stats`, { query: { days } })).items });
}

export function useWebhookDeliveries(id: string) {
  return useQuery({ queryKey: endpointKeys.deliveries(id), queryFn: async () => (await api.get<Page<WebhookDelivery>>(`/endpoints/${id}/webhook-deliveries`)).items });
}

export function useRedeliver(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (deliveryId: string) => api.post<WebhookDelivery>(`/endpoints/${id}/webhook-deliveries/${deliveryId}/redeliver`),
    onSuccess: () => qc.invalidateQueries({ queryKey: endpointKeys.deliveries(id) }),
  });
}

export function useOpenApi(id: string) {
  return useQuery({ queryKey: endpointKeys.openapi(id), queryFn: () => api.get<Record<string, unknown>>(`/endpoints/${id}/openapi.json`) });
}

/**
 * 배포 API 직접 호출(플레이그라운드). 외부 API라 api-client의 /api/v1 기준을 쓰지 않는다.
 * 목 모드에서는 같은 출처의 /a/… 를 MSW가 가로챈다.
 */
export async function invokeEndpoint(path: string, apiKey: string, payload: unknown, opts: { idempotencyKey?: string } = {}): Promise<InvokeResult> {
  const base = process.env.NEXT_PUBLIC_API_MOCKING === 'enabled' || typeof window === 'undefined' ? '' : (process.env.NEXT_PUBLIC_INVOKE_BASE_URL ?? '');
  const started = performance.now();
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}`, ...(opts.idempotencyKey ? { 'Idempotency-Key': opts.idempotencyKey } : {}) },
    body: typeof payload === 'string' ? payload : JSON.stringify(payload),
  });
  const text = await res.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    /* 텍스트 그대로 */
  }
  const headers: Record<string, string> = {};
  res.headers.forEach((v, k) => (headers[k] = v));
  return { status: res.status, headers, body, ms: Math.round(performance.now() - started) };
}

// ===== 확장: Slack 봇 연결(목) =====
export interface SlackLink {
  endpoint_id: string;
  team: string;
  channel: string;
  connected_at: string;
}

export function useSlackLink(endpointId: string) {
  return useQuery({ queryKey: ['endpoints', wsKey(), 'slack', endpointId], queryFn: () => api.get<SlackLink | null>(`/endpoints/${endpointId}/slack`) });
}

export function useConnectSlack(endpointId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { team: string; channel: string } | null) => (input ? api.put<SlackLink>(`/endpoints/${endpointId}/slack`, input) : api.delete(`/endpoints/${endpointId}/slack`)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['endpoints', wsKey(), 'slack', endpointId] }),
  });
}
