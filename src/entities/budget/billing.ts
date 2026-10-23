import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { api } from '@/shared/lib/api-client';
import { wsKey } from '@/shared/lib/query';

/** 결제·정산 정보(확장, 모의). 평문 카드·계좌 번호는 응답에 없다. */
export interface BillingInfo {
  card_brand: string;
  card_last4: string;
  payout_bank: string;
  payout_last4: string;
  payout_holder: string;
  updated_at: string;
}

export const billingFormSchema = z.object({
  card_brand: z.string().min(1, '카드사를 고르세요.'),
  card_number: z.string().refine((v) => !v || /^[\d\s-]{12,23}$/.test(v), '카드 번호는 12~19자리 숫자입니다.'),
  payout_bank: z.string().min(1, '은행을 고르세요.'),
  payout_account: z.string().refine((v) => !v || v.replace(/\D/g, '').length >= 8, '계좌 번호를 확인하세요.'),
  payout_holder: z.string().trim().min(1, '예금주를 입력하세요.'),
});
export type BillingForm = z.infer<typeof billingFormSchema>;

export function useBilling() {
  return useQuery({ queryKey: ['billing', wsKey()], queryFn: () => api.get<BillingInfo | null>('/billing') });
}

export function useUpdateBilling() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<BillingForm>) => api.put<BillingInfo>('/billing', { ...input, card_number: input.card_number || undefined, payout_account: input.payout_account || undefined }),
    onSuccess: (row) => qc.setQueryData(['billing', wsKey()], row),
  });
}
