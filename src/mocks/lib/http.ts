import { HttpResponse, delay } from 'msw';
import type { Role } from '@/entities/workspace/model';
import { ROLE_RANK } from '@/entities/workspace/model';
import { db } from '../db';
import { hex } from './util';

export const API = '*/api/v1';

/** 오류 코드 → 제목 (design.md 3.3.2) */
const TITLES: Record<string, string> = {
  'MOA-AUTH-001': '로그인 정보가 맞지 않습니다',
  'MOA-AUTH-002': '로그인이 필요합니다',
  'MOA-AUTH-003': '권한이 없습니다',
  'MOA-AUTH-010': 'API 키 형식이 올바르지 않습니다',
  'MOA-AUTH-011': '만료되었거나 폐기된 API 키입니다',
  'MOA-WF-001': '워크플로에 순환이 있습니다',
  'MOA-WF-002': '연결되지 않은 입력이 있습니다',
  'MOA-WF-003': '포트 타입이 맞지 않습니다',
  'MOA-WF-004': '시작 노드가 올바르지 않습니다',
  'MOA-WF-009': '초안 버전이 맞지 않습니다',
  'MOA-RUN-001': '지금 상태에서는 할 수 없는 작업입니다',
  'MOA-CTX-001': '컨텍스트 블록이 없습니다',
  'MOA-CTX-002': '고정된 블록은 바꿀 수 없습니다',
  'MOA-CTX-003': '다른 곳에서 먼저 수정했습니다',
  'MOA-API-001': '이미 쓰고 있는 슬러그입니다',
  'MOA-API-002': '엔드포인트가 없습니다',
  'MOA-API-003': '입력 값이 스키마와 맞지 않습니다',
  'MOA-API-005': '사용할 수 없는 슬러그입니다',
  'MOA-API-008': '명령 형식이 올바르지 않습니다',
  'MOA-RATE-001': '호출 한도를 넘었습니다',
  'MOA-BUD-001': '이번 달 예산을 모두 썼습니다',
  'MOA-BUD-002': '실행당 비용 한도를 넘었습니다',
  'MOA-MCP-001': 'MCP 서버에 연결하지 못했습니다',
  'MOA-APR-001': '이미 처리된 승인입니다',
  'MOA-APR-002': '만료되었거나 거부된 승인입니다',
  'MOA-MKT-001': '보안 검사를 통과하지 못했습니다',
  'MOA-MKT-002': '이미 구매한 라이선스입니다',
  'MOA-MKT-003': '판매하지 않는 라이선스입니다',
  'MOA-NOT-FOUND': '찾을 수 없습니다',
  'MOA-VALIDATION': '입력 값을 확인해 주세요',
  'MOA-SYS-500': '서버 오류가 발생했습니다',
  'MOA-SYS-503': '잠시 서비스를 쓸 수 없습니다',
};

const STATUS_OF: Record<string, number> = {
  'MOA-AUTH-001': 401,
  'MOA-AUTH-002': 401,
  'MOA-AUTH-003': 403,
  'MOA-AUTH-010': 401,
  'MOA-AUTH-011': 401,
  'MOA-WF-001': 422,
  'MOA-WF-002': 422,
  'MOA-WF-003': 422,
  'MOA-WF-004': 422,
  'MOA-WF-009': 409,
  'MOA-RUN-001': 409,
  'MOA-CTX-001': 404,
  'MOA-CTX-002': 422,
  'MOA-CTX-003': 409,
  'MOA-API-001': 409,
  'MOA-API-002': 404,
  'MOA-API-003': 422,
  'MOA-API-005': 422,
  'MOA-API-008': 422,
  'MOA-RATE-001': 429,
  'MOA-BUD-001': 402,
  'MOA-BUD-002': 402,
  'MOA-MCP-001': 502,
  'MOA-APR-001': 409,
  'MOA-APR-002': 410,
  'MOA-MKT-001': 422,
  'MOA-MKT-002': 409,
  'MOA-MKT-003': 403,
  'MOA-NOT-FOUND': 404,
  'MOA-VALIDATION': 422,
  'MOA-SYS-500': 500,
  'MOA-SYS-503': 503,
};

export function problem(code: string, detail?: string, extra: Record<string, unknown> = {}, statusOverride?: number) {
  const status = statusOverride ?? STATUS_OF[code] ?? 400;
  return HttpResponse.json(
    {
      type: `https://docs.moa.dev/errors/${code}`,
      title: TITLES[code] ?? '요청을 처리하지 못했습니다',
      status,
      code,
      detail: detail ?? TITLES[code] ?? code,
      request_id: `01J${hex(10).toUpperCase()}`,
      retryable: status === 429 || status === 503 || (status === 502 && code !== 'MOA-MCP-001'),
      ...extra,
    },
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  );
}

export const notFound = (what = '항목') => problem('MOA-NOT-FOUND', `${what}을(를) 찾을 수 없습니다.`);

/** 목 응답 지연(150~500ms). 테스트에서는 MOCK_DELAY=off로 끈다. */
export async function mockDelay() {
  if (typeof process !== 'undefined' && process.env?.MOCK_DELAY === 'off') return;
  await delay(150 + Math.floor(Math.random() * 350));
}

export interface Ctx {
  userId: string;
  wsId: string;
  role: Role;
}

/** 요청 문맥: 로그인 사용자 + X-Workspace-Id(없으면 첫 워크스페이스) + 역할 */
export function ctxOf(request: Request): Ctx | null {
  if (db.session.loggedOut) return null;
  const userId = db.session.userId;
  const url = new URL(request.url);
  const wsHeader = request.headers.get('X-Workspace-Id') ?? url.searchParams.get('workspace_id');
  const memberships = db.memberships.filter((m) => m.user_id === userId);
  const m = memberships.find((x) => x.workspace_id === wsHeader) ?? memberships[0];
  if (!m) return null;
  return { userId, wsId: m.workspace_id, role: m.role };
}

/** 로그인·권한 검사. 실패하면 Response를 돌려준다. */
export function guard(request: Request, min: Role = 'viewer'): Ctx | Response {
  const ctx = ctxOf(request);
  if (!ctx) return problem('MOA-AUTH-002');
  if (ROLE_RANK[ctx.role] < ROLE_RANK[min]) {
    return problem('MOA-AUTH-003', `이 작업은 ${min} 이상 권한이 필요합니다. 현재 역할: ${ctx.role}`);
  }
  return ctx;
}

export function isResponse(v: unknown): v is Response {
  return v instanceof Response;
}

/** 커서 페이지네이션 (design.md 2.6.1). 커서는 불투명 문자열(base64 오프셋). */
export function paginate<T>(items: T[], url: URL, defaultLimit = 20) {
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') ?? defaultLimit)));
  const cursor = url.searchParams.get('cursor');
  const offset = cursor ? Number(atob(cursor)) || 0 : 0;
  const page = items.slice(offset, offset + limit);
  const next = offset + limit < items.length ? btoa(String(offset + limit)) : null;
  return { items: page, next_cursor: next };
}

export async function body<T = Record<string, unknown>>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    return {} as T;
  }
}

export function ifMatch(request: Request): number | null {
  const v = request.headers.get('If-Match');
  if (v === null) return null;
  const n = Number(v.replace(/"/g, ''));
  return Number.isFinite(n) ? n : null;
}

export function json(data: unknown, init?: number | ResponseInit) {
  return HttpResponse.json(data as never, typeof init === 'number' ? { status: init } : init);
}
