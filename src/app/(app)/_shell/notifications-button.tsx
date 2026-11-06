'use client';

import { useRouter } from 'next/navigation';
import { Bell, Check, Loader2, Trash2, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  ACTION_STATE_LABEL,
  useDeleteNotification,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  useRespondInvitation,
  type Notification,
} from '@/entities/notification';
import { useCurrentWorkspaceStore } from '@/entities/workspace';
import { copy } from '@/shared/lib/copy';
import { cn } from '@/shared/lib/utils';
import { relativeTime } from '@/shared/lib/format';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover';
import { Skeleton } from '@/shared/ui/skeleton';
import { ErrorState } from '@/shared/ui/states';

/** 상단 알림함. 팀 초대는 여기서 바로 수락·거절한다. */
export function NotificationsButton() {
  const q = useNotifications();
  const readAll = useMarkAllNotificationsRead();
  const unread = q.data?.unreadCount ?? 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="relative size-[38px]" aria-label={copy.topbar.notifications(unread)} data-testid="notifications-button">
          <Bell aria-hidden />
          {unread > 0 ? (
            <span className="bg-danger absolute -top-1 -right-1 min-w-[18px] rounded-full px-1 text-center text-[11px] leading-[18px] font-semibold text-white" aria-hidden>
              {unread > 9 ? '9+' : unread}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[400px] p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <span className="font-semibold">{copy.notifications.title}</span>
          <Button size="sm" variant="ghost" disabled={unread === 0 || readAll.isPending} onClick={() => readAll.mutate()}>
            {copy.notifications.readAll}
          </Button>
        </div>
        <div className="max-h-[440px] overflow-y-auto p-2">
          {q.isPending ? (
            <div className="space-y-2 p-2">
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
            </div>
          ) : q.isError ? (
            <ErrorState compact error={q.error} onRetry={() => void q.refetch()} />
          ) : q.data!.items.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-sm">{copy.notifications.empty}</p>
              <p className="text-muted mt-1 text-xs">{copy.notifications.emptyHint}</p>
            </div>
          ) : (
            <ul className="space-y-1">
              {q.data!.items.map((n) => <NotificationItem key={n.id} n={n} />)}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function NotificationItem({ n }: { n: Notification }) {
  const router = useRouter();
  const setWs = useCurrentWorkspaceStore((s) => s.setId);
  const respond = useRespondInvitation();
  const markRead = useMarkNotificationRead();
  const del = useDeleteNotification();
  const pendingInvite = n.kind === 'invite' && n.actionState === 'pending' && !!n.workspaceId;
  const unread = !n.readAt;

  const answer = (accept: boolean) =>
    respond.mutate(
      { workspaceId: n.workspaceId!, accept },
      {
        onSuccess: (r) => {
          if (r.accepted && r.workspace) {
            const ws = r.workspace;
            toast.success(copy.notifications.accepted(ws.name), {
              action: { label: copy.notifications.goTeam, onClick: () => { setWs(ws.id); router.push('/home'); } },
            });
          } else toast.success(copy.notifications.declined);
        },
        onError: (e) => toast.error(e.message),
      },
    );

  return (
    <li
      className={cn('group hover:bg-surface flex gap-3 rounded-md p-3', unread && 'bg-primary/5')}
      onMouseEnter={() => { if (unread && !pendingInvite && !markRead.isPending) markRead.mutate(n.id); }}
    >
      <span className="bg-surface-strong mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full" aria-hidden>
        {n.kind === 'invite' || n.kind === 'invite_result' ? <Users className="size-4" /> : <Bell className="size-4" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">
          {unread ? <span className="sr-only">안 읽음 · </span> : null}
          {n.title}
        </p>
        {n.body ? <p className="text-muted mt-0.5 text-xs">{n.body}</p> : null}
        <div className="mt-1 flex items-center gap-2">
          <span className="text-muted text-xs">{relativeTime(n.createdAt)}</span>
          {n.actionState && n.actionState !== 'pending' ? <Badge variant="gray">{ACTION_STATE_LABEL[n.actionState]}</Badge> : null}
        </div>
        {pendingInvite ? (
          <div className="mt-2 flex gap-2">
            <Button size="sm" onClick={() => answer(true)} disabled={respond.isPending} data-testid="invite-accept">
              {respond.isPending ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />} {copy.notifications.accept}
            </Button>
            <Button size="sm" variant="outline" onClick={() => answer(false)} disabled={respond.isPending} data-testid="invite-decline">
              <X aria-hidden /> {copy.notifications.decline}
            </Button>
          </div>
        ) : null}
      </div>
      {!pendingInvite ? (
        <Button size="icon-xs" variant="ghost" className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100" onClick={() => del.mutate(n.id)} aria-label={`알림 지우기: ${n.title}`}>
          <Trash2 aria-hidden />
        </Button>
      ) : null}
    </li>
  );
}
