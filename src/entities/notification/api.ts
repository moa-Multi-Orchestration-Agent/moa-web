import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/lib/api-client';
import { notificationPageSchema, toNotification } from './model';

export const notificationKeys = { all: ['notifications'] as const };

/** 알림은 사용자 단위라 워크스페이스 키를 붙이지 않는다. 30초마다, 창으로 돌아올 때 새로 고친다. */
export function useNotifications() {
  return useQuery({
    queryKey: notificationKeys.all,
    queryFn: async () => notificationPageSchema.parse(await api.get('/notifications', { query: { limit: 50 } })),
    select: (d) => ({ items: d.items.map(toNotification), unreadCount: d.unread_count }),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/notifications/${id}/read`),
    onSettled: () => qc.invalidateQueries({ queryKey: notificationKeys.all }),
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post('/notifications/read-all'),
    onSettled: () => qc.invalidateQueries({ queryKey: notificationKeys.all }),
  });
}

export function useDeleteNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/notifications/${id}`),
    onSettled: () => qc.invalidateQueries({ queryKey: notificationKeys.all }),
  });
}

/** 팀 초대 수락·거절. 수락하면 워크스페이스 목록에 새 팀이 들어온다. */
export function useRespondInvitation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ workspaceId, accept }: { workspaceId: string; accept: boolean }) =>
      api.post<{ accepted: boolean; workspace: { id: string; name: string } | null }>(`/invitations/${workspaceId}/${accept ? 'accept' : 'decline'}`),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: notificationKeys.all });
      void qc.invalidateQueries({ queryKey: ['workspaces'] });
    },
  });
}
