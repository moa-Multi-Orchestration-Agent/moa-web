import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Page } from '@/shared/lib/api-client';
import { wsKey } from '@/shared/lib/query';

/** 3D 노드 파라미터 프리셋(확장, 목) */
export interface Preset3d {
  id: string;
  name: string;
  params: Record<string, unknown>;
  created_at: string;
}

export function usePresets3d() {
  return useQuery({ queryKey: ['presets-3d', wsKey()], queryFn: async () => (await api.get<Page<Preset3d>>('/presets/3d')).items, staleTime: 60_000 });
}

export function useSavePreset3d() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; params: Record<string, unknown> }) => api.post<Preset3d>('/presets/3d', input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['presets-3d'] }),
  });
}
