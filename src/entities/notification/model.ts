import { z } from 'zod';
import { camelKeys } from '@/shared/lib/case';

/** 내부 알림함(notifications). 팀 초대는 kind=invite, action_state=pending일 때 수락·거절할 수 있다. */
export const notificationRowSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  workspace_id: z.string().nullable(),
  workspace_name: z.string().nullable().optional(),
  kind: z.enum(['invite', 'invite_result', 'member', 'system']),
  title: z.string(),
  body: z.string(),
  data: z.record(z.string(), z.unknown()),
  action_state: z.enum(['pending', 'accepted', 'declined', 'canceled']).nullable(),
  read_at: z.string().nullable(),
  created_at: z.string(),
});
export type NotificationRow = z.infer<typeof notificationRowSchema>;
export const toNotification = (r: NotificationRow) => camelKeys(r);
export type Notification = ReturnType<typeof toNotification>;

export const notificationPageSchema = z.object({
  items: z.array(notificationRowSchema),
  unread_count: z.number(),
});

export const ACTION_STATE_LABEL: Record<string, string> = {
  accepted: '수락함',
  declined: '거절함',
  canceled: '초대가 취소됨',
};
