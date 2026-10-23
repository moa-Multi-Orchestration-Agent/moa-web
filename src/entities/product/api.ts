import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Page } from '@/shared/lib/api-client';
import { camelKeys } from '@/shared/lib/case';
import { flattenPages, wsKey } from '@/shared/lib/query';
import { z } from 'zod';
import {
  productDetailSchema,
  productRowSchema,
  reviewsResponseSchema,
  scanFindingSchema,
  toProduct,
  type LicenseType,
  type ProductDetailRow,
  type PurchaseResult,
  type SalesStats,
} from './model';

export interface ProductParams {
  q?: string;
  category?: string;
  sort?: string;
  kind?: 'agent' | 'workflow';
  license?: string;
  price?: 'free' | 'paid';
}

export const productKeys = {
  all: ['market'] as const,
  list: (p: ProductParams) => ['market', wsKey(), 'list', p] as const,
  detail: (id: string) => ['market', wsKey(), 'detail', id] as const,
  reviews: (id: string) => ['market', 'reviews', id] as const,
  mine: () => ['market', wsKey(), 'mine'] as const,
  stats: (days: number) => ['market', wsKey(), 'stats', days] as const,
};

export function useProducts(p: ProductParams = {}) {
  const q = useInfiniteQuery({
    queryKey: productKeys.list(p),
    queryFn: async ({ pageParam }) => {
      const r = await api.get<Page<unknown>>('/market/products', { query: { ...p, cursor: pageParam ?? undefined, limit: 12 } });
      return { items: productRowSchema.array().parse(r.items), next_cursor: r.next_cursor };
    },
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_cursor,
  });
  return { ...q, items: flattenPages(q.data).map(toProduct) };
}

export const toProductDetail = (r: ProductDetailRow) => camelKeys(r);
export type ProductDetail = ReturnType<typeof toProductDetail>;

export function useProduct(id: string | null | undefined) {
  return useQuery({
    queryKey: productKeys.detail(id ?? '_'),
    queryFn: async () => productDetailSchema.parse(await api.get(`/market/products/${id}`)),
    select: toProductDetail,
    enabled: !!id,
  });
}

export function useReviews(id: string) {
  return useQuery({ queryKey: productKeys.reviews(id), queryFn: async () => reviewsResponseSchema.parse(await api.get(`/market/products/${id}/reviews`, { query: { limit: 20 } })) });
}

export function usePurchase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, license_type }: { id: string; license_type: LicenseType }) => api.post<PurchaseResult>(`/market/products/${id}/purchase`, { license_type }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: productKeys.all });
      void qc.invalidateQueries({ queryKey: ['licenses'] });
      void qc.invalidateQueries({ queryKey: ['agents'] });
      void qc.invalidateQueries({ queryKey: ['workflows'] });
    },
  });
}

const scanSchema = z.object({ findings: z.array(scanFindingSchema) });
export function useScan() {
  return useMutation({ mutationFn: async (input: { agent_id: string; readme_md?: string }) => scanSchema.parse(await api.post('/market/scan', input)) });
}

export function useCreateListing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      agent_id: string;
      title: string;
      summary: string;
      category: string;
      tags: string[];
      readme_md: string;
      license_types: LicenseType[];
      price_clone_krw: number | null;
      price_api_month_krw: number | null;
    }) => api.post<{ id: string }>('/market/products', input),
    onSuccess: () => qc.invalidateQueries({ queryKey: productKeys.all }),
  });
}

const myProductSchema = productRowSchema.extend({ revenue_krw: z.number(), reject_reason: z.string().nullable() });
export function useMyProducts() {
  return useQuery({
    queryKey: productKeys.mine(),
    queryFn: async () => myProductSchema.array().parse((await api.get<Page<unknown>>('/market/my-products')).items),
    select: (rows) => rows.map((r) => camelKeys(r)),
  });
}

export function useSalesStats(days: number) {
  return useQuery({ queryKey: productKeys.stats(days), queryFn: () => api.get<SalesStats>('/market/sales-stats', { query: { days } }) });
}

// ===== 확장: 판매자 팔로우 · 무료 체험 · 리뷰 답글 =====
export interface SellerInfo {
  name: string;
  product_count: number;
  follower_count: number;
  following: boolean;
}

export function useSeller(name: string | null | undefined) {
  return useQuery({ queryKey: ['market', wsKey(), 'seller', name ?? '_'], queryFn: () => api.get<SellerInfo>(`/market/sellers/${encodeURIComponent(name!)}`), enabled: !!name });
}

export function useFollowSeller(name: string) {
  const qc = useQueryClient();
  const key = ['market', wsKey(), 'seller', name];
  return useMutation({
    mutationFn: (follow: boolean) => (follow ? api.post(`/market/sellers/${encodeURIComponent(name)}/follow`) : api.delete(`/market/sellers/${encodeURIComponent(name)}/follow`)),
    onMutate: async (follow) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<SellerInfo>(key);
      if (prev) qc.setQueryData<SellerInfo>(key, { ...prev, following: follow, follower_count: prev.follower_count + (follow ? 1 : -1) });
      return { prev };
    },
    onError: (_e, _v, ctx) => qc.setQueryData(key, ctx?.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });
}

export function useTrial(productId: string) {
  return useQuery({ queryKey: ['market', wsKey(), 'trial', productId], queryFn: () => api.get<{ limit: number; used: number; remaining: number }>(`/market/products/${productId}/trial`) });
}

export function useStartTrial(productId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Record<string, unknown>) => api.post<{ run: { id: string }; remaining: number }>(`/market/products/${productId}/trial`, { input }),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['market', wsKey(), 'trial', productId] });
      void qc.invalidateQueries({ queryKey: ['runs'], refetchType: 'none' });
    },
  });
}

export function useReplyReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) => api.post(`/market/reviews/${id}/reply`, { body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: productKeys.all }),
  });
}
