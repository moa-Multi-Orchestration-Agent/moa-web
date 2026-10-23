import { http } from 'msw';
import { db } from '../db';
import { API, body, ctxOf, json, problem } from '../lib/http';
import { fid, nowIso } from '../lib/util';

const me = () => {
  const u = db.users.find((x) => x.id === db.session.userId)!;
  const { password: _p, ...rest } = u;
  return rest;
};

export const authHandlers = [
  http.post(`${API}/auth/login`, async ({ request }) => {
    const b = await body<{ email?: string; password?: string }>(request);
    if (!b.email || !b.password) return problem('MOA-VALIDATION', '이메일과 비밀번호를 입력하세요.', { errors: [{ loc: ['body', !b.email ? 'email' : 'password'], msg: 'Field required' }] });
    // 목: 어떤 이메일/비밀번호든 성공. 오류 화면 확인용으로 'wrong-password'만 거부한다.
    if (b.password === 'wrong-password') return problem('MOA-AUTH-001', '이메일 또는 비밀번호가 맞지 않습니다.');
    db.session.loggedOut = false;
    db.session.userId = fid('u', 1);
    const u = db.users.find((x) => x.id === db.session.userId)!;
    if (b.email && b.email !== u.email) u.email = b.email;
    return json({ user: me() });
  }),
  http.post(`${API}/auth/signup`, async ({ request }) => {
    const b = await body<{ email?: string; password?: string; display_name?: string }>(request);
    if (!b.email || !b.password || !b.display_name) return problem('MOA-VALIDATION', '필수 값을 입력하세요.');
    if (db.users.some((u) => u.email === b.email && u.id !== db.session.userId)) return problem('MOA-VALIDATION', '이미 가입한 이메일입니다.', {}, 409);
    db.session.loggedOut = false;
    const u = db.users.find((x) => x.id === db.session.userId)!;
    Object.assign(u, { email: b.email, display_name: b.display_name, updated_at: nowIso() });
    return json({ user: me() }, 201);
  }),
  http.get(`${API}/auth/oauth/:provider/callback`, ({ params }) => {
    db.session.loggedOut = false;
    const u = db.users.find((x) => x.id === db.session.userId)!;
    u.oauth_provider = String(params.provider);
    return json({ user: me() });
  }),
  http.post(`${API}/auth/refresh`, () => (db.session.loggedOut ? problem('MOA-AUTH-002') : json({ ok: true }))),
  http.post(`${API}/auth/logout`, () => {
    db.session.loggedOut = true;
    return json({ ok: true });
  }),
  http.get(`${API}/auth/me`, ({ request }) => {
    if (!ctxOf(request)) return problem('MOA-AUTH-002');
    return json({ user: me() });
  }),
];

