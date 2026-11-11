import { http } from 'msw';
import { API, guard, isResponse, json, problem } from '../lib/http';

export const stockNewsHandlers = [
  http.get(`${API}/stock-news/latest`, ({ request }) => {
    const ctx = guard(request);
    if (isResponse(ctx)) return ctx;
    return json({ edition: null, status: 'empty', error: null, schedule: '매일 07:00 Asia/Seoul', scheduler_enabled: false });
  }),
  http.post(`${API}/stock-news/refresh`, () => problem('MOA-SYS-503', '실제 뉴스 수집은 실제 백엔드 모드에서 사용할 수 있습니다.')),
];
