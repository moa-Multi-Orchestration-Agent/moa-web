import { http } from 'msw';
import type { DbNotification } from '../db';
import { db } from '../db';
import { API, body, ctxOf, guard, isResponse, json, notFound, problem } from '../lib/http';
import { nowIso, uuid } from '../lib/util';

const ROLE_LABEL: Record<string, string> = { owner: '소유자', admin: '관리자', maker: '제작자', viewer: '뷰어' };

export function notify(n: Omit<DbNotification, 'id' | 'created_at' | 'read_at' | 'action_state' | 'data' | 'body'> & Partial<DbNotification>) {
  db.notifications.unshift({ id: uuid(), created_at: nowIso(), read_at: null, action_state: null, data: {}, body: '', ...n });
}

const notificationView = (n: DbNotification) => ({ ...n, workspace_name: db.workspaces.find((w) => w.id === n.workspace_id)?.name ?? null });

/** 처리 전 초대 알림의 상태를 바꾼다 */
export function settleInvite(userId: string, wsId: string, state: 'accepted' | 'declined' | 'canceled') {
  for (const n of db.notifications) {
    if (n.user_id === userId && n.workspace_id === wsId && n.kind === 'invite' && n.action_state === 'pending') {
      n.action_state = state;
      if (state !== 'canceled') n.read_at = nowIso();
    }
  }
}

function slugify(name: string) {
  const base = name.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30);
  let slug = base.length >= 3 ? base : 'team';
  let i = 1;
  while (db.workspaces.some((w) => w.slug === slug)) slug = `${base.length >= 3 ? base : 'team'}-${++i}`;
  return slug;
}

/** 내부 알림함·팀 초대 응답·팀 만들기/삭제/나가기/소유권 이전 */
export const teamHandlers = [
  http.get(`${API}/notifications`, ({ request }) => {
    const ctx = ctxOf(request);
    if (!ctx && db.session.loggedOut) return problem('MOA-AUTH-002');
    const uid = db.session.userId;
    const url = new URL(request.url);
    const mine = db.notifications.filter((n) => n.user_id === uid);
    const items = (url.searchParams.get('unread') === 'true' ? mine.filter((n) => !n.read_at) : mine).sort((a, b) => b.created_at.localeCompare(a.created_at));
    return json({ items: items.map(notificationView), unread_count: mine.filter((n) => !n.read_at).length, next_cursor: null });
  }),
  http.post(`${API}/notifications/read-all`, () => {
    let updated = 0;
    for (const n of db.notifications) if (n.user_id === db.session.userId && !n.read_at) { n.read_at = nowIso(); updated++; }
    return json({ updated });
  }),
  http.post(`${API}/notifications/:id/read`, ({ params }) => {
    const n = db.notifications.find((x) => x.id === params.id && x.user_id === db.session.userId);
    if (!n) return notFound('알림');
    n.read_at ??= nowIso();
    return json(notificationView(n));
  }),
  http.delete(`${API}/notifications/:id`, ({ params }) => {
    const n = db.notifications.find((x) => x.id === params.id && x.user_id === db.session.userId);
    if (!n) return notFound('알림');
    if (n.kind === 'invite' && n.action_state === 'pending') return problem('MOA-VALIDATION', '처리하지 않은 초대는 수락하거나 거절해 주세요.', {}, 409);
    db.notifications = db.notifications.filter((x) => x !== n);
    return new Response(null, { status: 204 });
  }),
  http.get(`${API}/invitations`, () => {
    const items = db.memberships
      .filter((m) => m.user_id === db.session.userId && m.invited)
      .map((m) => {
        const w = db.workspaces.find((x) => x.id === m.workspace_id)!;
        const by = db.users.find((u) => u.id === m.invited_by);
        return { workspace_id: w.id, workspace_name: w.name, workspace_slug: w.slug, role: m.role, invited_by: by ? { id: by.id, display_name: by.display_name } : null, created_at: m.created_at };
      });
    return json({ items, next_cursor: null });
  }),
  http.post(`${API}/invitations/:wsId/:action`, ({ params }) => {
    const uid = db.session.userId;
    const accept = params.action === 'accept';
    if (!accept && params.action !== 'decline') return notFound();
    const m = db.memberships.find((x) => x.workspace_id === params.wsId && x.user_id === uid && x.invited);
    if (!m) return notFound('초대');
    const ws = db.workspaces.find((w) => w.id === m.workspace_id)!;
    const me = db.users.find((u) => u.id === uid)!;
    if (accept) {
      m.invited = false;
      m.created_at = nowIso();
      m.last_seen_at = nowIso();
    } else {
      db.memberships = db.memberships.filter((x) => x !== m);
    }
    settleInvite(uid, ws.id, accept ? 'accepted' : 'declined');
    if (m.invited_by) notify({ user_id: m.invited_by, workspace_id: ws.id, kind: 'invite_result', title: `${me.display_name}님이 '${ws.name}' 초대를 ${accept ? '수락' : '거절'}했습니다`, data: { user_id: uid, accepted: accept } });
    return json({ accepted: accept, workspace: accept ? { ...ws, role: m.role } : null });
  }),

  http.post(`${API}/workspaces`, async ({ request }) => {
    if (db.session.loggedOut) return problem('MOA-AUTH-002');
    const b = await body<{ name?: string; slug?: string }>(request);
    const name = (b.name ?? '').trim();
    if (!name) return problem('MOA-VALIDATION', '팀 이름을 입력하세요.', { errors: [{ loc: ['body', 'name'], msg: 'required' }] });
    if (name.length > 40) return problem('MOA-VALIDATION', '팀 이름은 40자 이하입니다.');
    const now = nowIso();
    const ws = { id: uuid(), slug: slugify(name), name, plan: 'free', settings: { compress_threshold: 0.7 }, created_at: now, updated_at: now };
    db.workspaces.push(ws);
    db.memberships.push({ workspace_id: ws.id, user_id: db.session.userId, role: 'owner', created_at: now, last_seen_at: now });
    return json({ ...ws, role: 'owner' }, 201);
  }),
  http.delete(`${API}/workspaces/:id`, async ({ request, params }) => {
    const ctx = guard(request, 'owner');
    if (isResponse(ctx)) return ctx;
    if (params.id !== ctx.wsId) return problem('MOA-AUTH-003');
    const ws = db.workspaces.find((w) => w.id === ctx.wsId)!;
    const b = await body<{ confirm_name?: string }>(request);
    if ((b.confirm_name ?? '').trim() !== ws.name) return problem('MOA-VALIDATION', '확인용 팀 이름이 맞지 않습니다.', { errors: [{ loc: ['body', 'confirm_name'], msg: 'mismatch' }] });
    if (db.memberships.filter((m) => m.user_id === ctx.userId && !m.invited).length <= 1) return problem('MOA-VALIDATION', '마지막 남은 팀은 삭제할 수 없습니다. 다른 팀을 먼저 만드세요.', {}, 409);
    for (const m of db.memberships.filter((x) => x.workspace_id === ws.id && x.user_id !== ctx.userId && !x.invited)) {
      notify({ user_id: m.user_id, workspace_id: null, kind: 'member', title: `'${ws.name}' 팀이 삭제되었습니다`, body: '소유자가 팀을 삭제해 더 이상 접근할 수 없습니다.' });
    }
    db.memberships = db.memberships.filter((m) => m.workspace_id !== ws.id);
    db.notifications = db.notifications.filter((n) => n.workspace_id !== ws.id);
    db.workspaces = db.workspaces.filter((w) => w !== ws);
    return new Response(null, { status: 204 });
  }),
  http.post(`${API}/workspaces/:id/leave`, ({ request, params }) => {
    const ctx = guard(request);
    if (isResponse(ctx)) return ctx;
    if (params.id !== ctx.wsId) return problem('MOA-AUTH-003');
    if (ctx.role === 'owner') return problem('MOA-VALIDATION', '소유자는 나갈 수 없습니다. 먼저 다른 멤버에게 소유권을 넘기세요.', {}, 409);
    db.memberships = db.memberships.filter((m) => !(m.workspace_id === ctx.wsId && m.user_id === ctx.userId));
    return new Response(null, { status: 204 });
  }),
  http.post(`${API}/workspaces/:id/transfer`, async ({ request, params }) => {
    const ctx = guard(request, 'owner');
    if (isResponse(ctx)) return ctx;
    if (params.id !== ctx.wsId) return problem('MOA-AUTH-003');
    const b = await body<{ user_id?: string }>(request);
    if (b.user_id === ctx.userId) return problem('MOA-VALIDATION', '이미 소유자입니다.');
    const target = db.memberships.find((m) => m.workspace_id === ctx.wsId && m.user_id === b.user_id && !m.invited);
    if (!target) return notFound('멤버');
    const me = db.memberships.find((m) => m.workspace_id === ctx.wsId && m.user_id === ctx.userId)!;
    me.role = 'admin';
    target.role = 'owner';
    const ws = db.workspaces.find((w) => w.id === ctx.wsId)!;
    notify({ user_id: target.user_id, workspace_id: ws.id, kind: 'member', title: `'${ws.name}' 팀의 소유자가 되었습니다`, body: '이제 팀 삭제와 소유권 이전을 할 수 있습니다.' });
    const u = db.users.find((x) => x.id === target.user_id)!;
    return json({ ...target, user: { id: u.id, email: u.email, display_name: u.display_name } });
  }),
];

export { ROLE_LABEL };
