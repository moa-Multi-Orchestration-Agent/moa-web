import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Page } from '@/shared/lib/api-client';
import { patchEverywhere, restore } from '@/shared/lib/query';
import {
  can,
  memberRowSchema,
  toMember,
  toWorkspace,
  workspaceRowSchema,
  type InviteForm,
  type MemberRow,
  type Permission,
  type Role,
  type WorkspaceRow,
} from './model';
import { useCurrentWorkspaceStore } from './store';

export const workspaceKeys = {
  all: ['workspaces'] as const,
  list: () => ['workspaces', 'list'] as const,
  members: (id: string) => ['members', id] as const,
};

export async function fetchWorkspaces() {
  const r = await api.get<Page<unknown>>('/workspaces');
  return workspaceRowSchema.array().parse(r.items);
}

export function useWorkspaces(opts: { enabled?: boolean } = {}) {
  return useQuery({ queryKey: workspaceKeys.list(), queryFn: fetchWorkspaces, select: (rows) => rows.map(toWorkspace), staleTime: 60_000, ...opts });
}

/** 현재 워크스페이스와 내 역할, 권한 확인 함수 */
export function useCurrentWorkspace() {
  const id = useCurrentWorkspaceStore((s) => s.id);
  const q = useWorkspaces();
  const ws = q.data?.find((w) => w.id === id) ?? q.data?.[0] ?? null;
  const role: Role | null = ws?.role ?? null;
  return { workspace: ws, role, can: (p: Permission) => can(role, p), isPending: q.isPending, query: q };
}

export function useUpdateWorkspace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string; name?: string; slug?: string; settings?: { compress_threshold?: number } }) =>
      api.patch<WorkspaceRow>(`/workspaces/${id}`, patch),
    onMutate: async ({ id, ...patch }) => {
      await qc.cancelQueries({ queryKey: workspaceKeys.all });
      const snap = patchEverywhere<WorkspaceRow>(qc, workspaceKeys.all, id, (w) => ({ ...w, ...patch, settings: { ...w.settings, ...patch.settings } }) as WorkspaceRow);
      return { snap };
    },
    onError: (_e, _v, ctx) => restore(qc, ctx?.snap),
    onSettled: () => qc.invalidateQueries({ queryKey: workspaceKeys.all }),
  });
}

export function useMembers(workspaceId: string | null | undefined) {
  return useQuery({
    queryKey: workspaceKeys.members(workspaceId ?? '_'),
    queryFn: async () => memberRowSchema.array().parse((await api.get<Page<unknown>>(`/workspaces/${workspaceId}/members`)).items),
    select: (rows) => rows.map(toMember),
    enabled: !!workspaceId,
  });
}

export function useInvite(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: InviteForm) => api.post<MemberRow>(`/workspaces/${workspaceId}/invites`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: workspaceKeys.members(workspaceId) }),
  });
}

export function useUpdateMemberRole(workspaceId: string) {
  const qc = useQueryClient();
  const key = workspaceKeys.members(workspaceId);
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: Role }) => api.patch<MemberRow>(`/workspaces/${workspaceId}/members/${userId}`, { role }),
    onMutate: async ({ userId, role }) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<MemberRow[]>(key);
      qc.setQueryData<MemberRow[]>(key, (rows) => rows?.map((m) => (m.user_id === userId ? { ...m, role } : m)));
      return { prev };
    },
    onError: (_e, _v, ctx) => qc.setQueryData(key, ctx?.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });
}

export function useRemoveMember(workspaceId: string) {
  const qc = useQueryClient();
  const key = workspaceKeys.members(workspaceId);
  return useMutation({
    mutationFn: (userId: string) => api.delete(`/workspaces/${workspaceId}/members/${userId}`),
    onMutate: async (userId) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<MemberRow[]>(key);
      qc.setQueryData<MemberRow[]>(key, (rows) => rows?.filter((m) => m.user_id !== userId));
      return { prev };
    },
    onError: (_e, _v, ctx) => qc.setQueryData(key, ctx?.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });
}

