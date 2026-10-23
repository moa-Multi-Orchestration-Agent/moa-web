import { z } from 'zod';
import { camelKeys } from '@/shared/lib/case';
import { licenseTypeSchema } from '../product/model';

export const licenseRowSchema = z
  .object({
    id: z.string(),
    product_id: z.string(),
    version_id: z.string(),
    buyer_ws: z.string(),
    purchase_id: z.string(),
    type: licenseTypeSchema,
    expires_at: z.string().nullable(),
    revoked_at: z.string().nullable(),
    created_at: z.string(),
    /** 표시용 확장 */
    product_title: z.string(),
    product_kind: z.enum(['agent', 'workflow']),
    amount_krw: z.number(),
    semver: z.string(),
    reviewed: z.boolean(),
  })
  ;
export type LicenseRow = z.infer<typeof licenseRowSchema>;
export const toLicense = (r: LicenseRow) => camelKeys(r);
export type License = ReturnType<typeof toLicense>;

export const reviewFormSchema = z.object({
  rating: z.number().int().min(1, '별점을 고르세요.').max(5),
  body: z.string().max(1000, '1000자 이하로 써 주세요.'),
});
export type ReviewForm = z.infer<typeof reviewFormSchema>;
