import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Page } from '@/shared/lib/api-client';
import { wsKey } from '@/shared/lib/query';
import { licenseRowSchema, toLicense, type LicenseRow, type ReviewForm } from './model';

export const licenseKeys = { all: ['licenses'] as const, list: () => ['licenses', wsKey()] as const };

export function useLicenses() {
  return useQuery({
    queryKey: licenseKeys.list(),
    queryFn: async () => licenseRowSchema.array().parse((await api.get<Page<unknown>>('/licenses')).items),
    select: (rows) => rows.map(toLicense),
  });
}

export function useWriteReview() {
  const qc = useQueryClient();
  const key = licenseKeys.list();
  return useMutation({
    mutationFn: ({ licenseId, ...input }: ReviewForm & { licenseId: string }) => api.post(`/licenses/${licenseId}/review`, input),
    onMutate: async ({ licenseId }) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<LicenseRow[]>(key);
      qc.setQueryData<LicenseRow[]>(key, (rows) => rows?.map((l) => (l.id === licenseId ? { ...l, reviewed: true } : l)));
      return { prev };
    },
    onError: (_e, _v, ctx) => qc.setQueryData(key, ctx?.prev),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: licenseKeys.all });
      void qc.invalidateQueries({ queryKey: ['market'] });
    },
  });
}
