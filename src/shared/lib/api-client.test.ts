import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '@/mocks/server';
import { ApiError, api, setWorkspaceId } from './api-client';

describe('api-client', () => {
  it('X-Workspace-Id와 If-Match 헤더를 붙인다', async () => {
    let seen: Record<string, string | null> = {};
    server.use(
      http.put('http://localhost/api/v1/things/1', ({ request }) => {
        seen = { ws: request.headers.get('X-Workspace-Id'), ifMatch: request.headers.get('If-Match') };
        return HttpResponse.json({ ok: true });
      }),
    );
    setWorkspaceId('ws-1');
    await api.put('/things/1', { a: 1 }, { ifMatch: 14 });
    expect(seen).toEqual({ ws: 'ws-1', ifMatch: '14' });
    setWorkspaceId(null);
  });

  it('Problem Details를 ApiError로 바꾼다', async () => {
    server.use(
      http.get('http://localhost/api/v1/boom', () =>
        HttpResponse.json(
          { code: 'MOA-API-001', status: 409, title: '충돌', detail: '이미 쓰는 슬러그입니다', retryable: false, request_id: 'r1' },
          { status: 409 },
        ),
      ),
    );
    const err = await api.get('/boom').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ code: 'MOA-API-001', status: 409, detail: '이미 쓰는 슬러그입니다', retryable: false, requestId: 'r1' });
  });

  it('본문 없는 5xx도 retryable 판단과 함께 변환한다', async () => {
    server.use(http.get('http://localhost/api/v1/down', () => new HttpResponse(null, { status: 503 })));
    const err = (await api.get('/down').catch((e: unknown) => e)) as ApiError;
    expect(err.status).toBe(503);
    expect(err.retryable).toBe(true);
  });

  it('쿼리 문자열을 만든다(빈 값 제외)', async () => {
    let url = '';
    server.use(
      http.get('http://localhost/api/v1/list', ({ request }) => {
        url = request.url;
        return HttpResponse.json({ items: [], next_cursor: null });
      }),
    );
    await api.get('/list', { query: { q: '에이', limit: 20, empty: '', tags: ['a', 'b'] } });
    expect(new URL(url).searchParams.getAll('tags')).toEqual(['a', 'b']);
    expect(new URL(url).searchParams.has('empty')).toBe(false);
  });
});
