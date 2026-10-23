import { z } from 'zod';
import { camelKeys } from '@/shared/lib/case';

export const MARKET_CATEGORIES = [
  { id: 'research', label: '리서치' },
  { id: 'marketing', label: '마케팅' },
  { id: 'docs', label: '문서' },
  { id: 'design', label: '디자인' },
  { id: 'support', label: '고객 응대' },
  { id: 'dev', label: '개발' },
  { id: 'hr', label: 'HR' },
] as const;
export const marketCategoryLabel = (id: string) => MARKET_CATEGORIES.find((c) => c.id === id)?.label ?? id;

export const MARKET_SORTS = [
  { id: 'popular', label: '인기순' },
  { id: 'rating', label: '평점순' },
  { id: 'newest', label: '최신순' },
  { id: 'price_asc', label: '낮은 가격순' },
  { id: 'price_desc', label: '높은 가격순' },
] as const;

export const licenseTypeSchema = z.enum(['clone', 'api_sub']);
export type LicenseType = z.infer<typeof licenseTypeSchema>;
export const LICENSE_LABEL: Record<LicenseType, string> = { clone: '복제 라이선스', api_sub: 'API 사용 구독' };

export const productRowSchema = z
  .object({
    id: z.string(),
    seller_ws: z.string(),
    agent_id: z.string().nullable(),
    endpoint_id: z.string().nullable(),
    title: z.string(),
    summary: z.string(),
    category: z.string(),
    tags: z.array(z.string()),
    license_types: z.array(licenseTypeSchema),
    price_clone_krw: z.number().nullable(),
    price_api_month_krw: z.number().nullable(),
    status: z.enum(['draft', 'in_review', 'published', 'suspended']),
    rating_avg: z.number(),
    rating_count: z.number(),
    install_count: z.number(),
    created_at: z.string(),
    updated_at: z.string(),
    /** 표시용 확장 */
    kind: z.enum(['agent', 'workflow']),
    seller_name: z.string(),
    mine: z.boolean(),
    latest_semver: z.string(),
    icon: z.string(),
    owned_license: licenseTypeSchema.nullable(),
  })
  ;
export type ProductRow = z.infer<typeof productRowSchema>;
export const toProduct = (r: ProductRow) => camelKeys(r);
export type Product = ReturnType<typeof toProduct>;

export const marketVersionRowSchema = z.object({
  id: z.string(),
  product_id: z.string(),
  semver: z.string(),
  changelog: z.string().nullable(),
  created_at: z.string(),
});
export type MarketVersionRow = z.infer<typeof marketVersionRowSchema>;

export const productDetailSchema = productRowSchema.extend({
  readme_md: z.string().nullable(),
  versions: z.array(marketVersionRowSchema),
  screenshots: z.array(z.string()),
  preview: z.object({ model: z.string().nullable(), skills: z.array(z.string()), workflows: z.array(z.string()), public: z.boolean() }),
  requirements: z.array(z.object({ label: z.string(), status: z.enum(['builtin', 'connected', 'missing', 'seller']) })),
  seller: z.object({ name: z.string(), product_count: z.number(), joined_at: z.string() }),
});
export type ProductDetailRow = z.infer<typeof productDetailSchema>;

export const reviewRowSchema = z
  .object({
    id: z.string(),
    product_id: z.string(),
    license_id: z.string().nullable(),
    author: z.string(),
    rating: z.number(),
    body: z.string().nullable(),
    created_at: z.string(),
    author_name: z.string(),
    reply: z.object({ body: z.string(), created_at: z.string() }).nullable().optional(),
  })
  ;
export type ReviewRow = z.infer<typeof reviewRowSchema>;

export const reviewsResponseSchema = z.object({
  items: z.array(reviewRowSchema),
  next_cursor: z.string().nullable(),
  distribution: z.record(z.number()),
});

export const scanFindingSchema = z.object({
  path: z.string(),
  rule: z.string(),
  severity: z.enum(['info', 'warn', 'error']),
  excerpt: z.string(),
});
export type ScanFinding = z.infer<typeof scanFindingSchema>;

export const listingFormSchema = z
  .object({
    agent_id: z.string().min(1, '게시할 항목을 고르세요.'),
    title: z.string().trim().min(2, '제목은 2자 이상입니다.').max(60),
    summary: z.string().trim().min(10, '요약은 10자 이상입니다.').max(140),
    category: z.string().min(1, '카테고리를 고르세요.'),
    tags: z.array(z.string()).max(8, '태그는 8개까지입니다.'),
    readme_md: z.string().max(65_536, 'README는 64KB 이하입니다.'),
    free: z.boolean(),
    sell_clone: z.boolean(),
    sell_api: z.boolean(),
    price_clone_krw: z.number().int().min(0),
    price_api_month_krw: z.number().int().min(0),
  })
  .refine((v) => v.free || v.sell_clone || v.sell_api, { message: '라이선스를 하나 이상 고르세요.', path: ['free'] });
export type ListingForm = z.infer<typeof listingFormSchema>;

export interface PurchaseResult {
  license: { id: string; type: LicenseType; expires_at: string | null };
  purchase: { id: string; amount_krw: number; status: string };
  clone?: { agent_id: string | null; workflow_ids: string[]; missing: { label: string }[] };
  api?: { endpoint_url: string; expires_at: string };
}

export interface SalesStats {
  month_revenue_krw: number;
  new_installs: number;
  rating_avg: number;
  next_payout_krw: number;
  series: { date: string; revenue_krw: number; installs: number }[];
  recent_reviews: ReviewRow[];
}
