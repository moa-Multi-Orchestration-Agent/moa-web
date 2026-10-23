import { http } from 'msw';
import { API, mockDelay, problem } from '../lib/http';

/**
 * 모든 /api/v1 요청 앞단:
 * - 150~500ms 랜덤 지연
 * - `?mock_error=<코드>`가 있으면 그 Problem Details 오류를 돌려준다(개발 확인용)
 * 응답을 돌려주지 않으면 다음 핸들러로 넘어간다.
 */
export const middleware = [
  http.all(`${API}/*`, async ({ request }) => {
    const url = new URL(request.url);
    const code = url.searchParams.get('mock_error');
    if (!url.pathname.endsWith('/events')) await mockDelay();
    if (code) return problem(code, `?mock_error=${code} 로 만든 확인용 오류입니다.`);
    return undefined;
  }),
];

