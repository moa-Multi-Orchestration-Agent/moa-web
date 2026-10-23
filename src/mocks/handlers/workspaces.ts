import { http } from 'msw';
import { workspaceSlugRe } from '@/entities/workspace/model';
import { db } from '../db';
import { API, body, ctxOf, guard, isResponse, json, notFound, problem } from '../lib/http';
import { nowIso, uuid } from '../lib/util';

function memberView(m: (typeof db.memberships)[number]) {
  const u = db.users.find((x) => x.id === m.user_id)!;
  return { ...m, user: { id: u.id, email: u.email, display_name: u.display_name } };
}

export const workspaceHandlers = [
  http.get(`${API}/workspaces`, ({ request }) => {
    const ctx = ctxOf(request);
    if (!ctx) return problem('MOA-AUTH-002');
    const items = db.memberships
      .filter((m) => m.user_id === ctx.userId)
      .map((m) => ({ ...db.workspaces.find((w) => w.id === m.workspace_id)!, role: m.role }));
    return json({ items, next_cursor: null });
  }),
  http.patch(`${API}/workspaces/:id`, async ({ request, params }) => {
    const ctx = guard(request, 'admin');
    if (isResponse(ctx)) return ctx;
    const ws = db.workspaces.find((w) => w.id === params.id);
    if (!ws || ws.id !== ctx.wsId) return notFound('워크스페이스');
    const b = await body<{ name?: string; slug?: string; settings?: { compress_threshold?: number } }>(request);
    if (b.slug !== undefined) {
      if (!workspaceSlugRe.test(b.slug)) return problem('MOA-VALIDATION', 'slug 형식이 올바르지 않습니다.', { errors: [{ loc: ['body', 'slug'], msg: 'pattern' }] });
      if (db.workspaces.some((w) => w.slug === b.slug && w.id !== ws.id)) return problem('MOA-VALIDATION', '이미 쓰는 slug입니다.', {}, 409);
      ws.slug = b.slug;
    }
    if (b.name !== undefined) ws.name = b.name;
    if (b.settings) ws.settings = { ...ws.settings, ...b.settings } as typeof ws.settings;
    ws.updated_at = nowIso();
    return json({ ...ws, role: ctx.role });
  }),
  http.get(`${API}/workspaces/:id/members`, ({ request, params }) => {
    const ctx = guard(request);
    if (isResponse(ctx)) return ctx;
    if (params.id !== ctx.wsId) return problem('MOA-AUTH-003');
    const items = db.memberships.filter((m) => m.workspace_id === ctx.wsId).map(memberView);
    return json({ items, next_cursor: null });
  }),
  http.post(`${API}/workspaces/:id/invites`, async ({ request, params }) => {
    const ctx = guard(request, 'admin');
    if (isResponse(ctx)) return ctx;
    if (params.id !== ctx.wsId) return problem('MOA-AUTH-003');
    const b = await body<{ email: string; role: 'admin' | 'maker' | 'viewer' }>(request);
    if (!b.email) return problem('MOA-VALIDATION', '이메일을 입력하세요.');
    let user = db.users.find((u) => u.email === b.email);
    if (user && db.memberships.some((m) => m.workspace_id === ctx.wsId && m.user_id === user!.id)) {
      return problem('MOA-VALIDATION', '이미 멤버이거나 초대한 사람입니다.', {}, 409);
    }
    if (!user) {
      user = { id: uuid(), email: b.email, display_name: b.email.split('@')[0]!, password: null, oauth_provider: null, created_at: nowIso(), updated_at: nowIso() };
      db.users.push(user);
    }
    const m = { workspace_id: ctx.wsId, user_id: user.id, role: b.role ?? 'maker', created_at: nowIso(), last_seen_at: null, invited: true };
    db.memberships.push(m);
    return json(memberView(m), 201);
  }),
  http.patch(`${API}/workspaces/:id/members/:userId`, async ({ request, params }) => {
    const ctx = guard(request, 'admin');
    if (isResponse(ctx)) return ctx;
    const m = db.memberships.find((x) => x.workspace_id === ctx.wsId && x.user_id === params.userId);
    if (!m) return notFound('멤버');
    const b = await body<{ role: 'owner' | 'admin' | 'maker' | 'viewer' }>(request);
    if (m.role === 'owner') return problem('MOA-AUTH-003', '소유자의 역할은 바꿀 수 없습니다. 소유권 이전은 소유자만 할 수 있습니다.', {}, 409);
    if (b.role === 'owner') return problem('MOA-AUTH-003', '워크스페이스 소유자는 1명입니다. 소유권 이전 기능을 쓰세요.', {}, 409);
    if (ctx.role === 'admin' && m.role === 'admin' && m.user_id !== ctx.userId) {
      // admin은 owner를 제외한 역할 변경 가능(3.1.1)
    }
    m.role = b.role;
    return json(memberView(m));
  }),
  http.delete(`${API}/workspaces/:id/members/:userId`, ({ request, params }) => {
    const ctx = guard(request, 'admin');
    if (isResponse(ctx)) return ctx;
    const idx = db.memberships.findIndex((x) => x.workspace_id === ctx.wsId && x.user_id === params.userId);
    if (idx < 0) return notFound('멤버');
    if (db.memberships[idx]!.role === 'owner') return problem('MOA-AUTH-003', '소유자는 제거할 수 없습니다.', {}, 409);
    db.memberships.splice(idx, 1);
    return new Response(null, { status: 204 });
  }),
];
