/**
 * 모든 API 호출이 거치는 단일 클라이언트 (CLAUDE.md 규칙).
 * - baseURL `/api/v1`
 * - `X-Workspace-Id` 헤더
 * - `If-Match` 헤더(낙관적 잠금)
 * - Problem Details(RFC 9457, design.md 3.3.1) → ApiError
 */

export interface ProblemDetails {
  type?: string;
  title?: string;
  status: number;
  code: string;
  detail?: string;
  errors?: { loc: (string | number)[]; msg: string }[];
  request_id?: string;
  retryable?: boolean;
  [extra: string]: unknown;
}

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly detail: string;
  readonly retryable: boolean;
  readonly title?: string;
  readonly errors?: ProblemDetails['errors'];
  readonly requestId?: string;
  readonly body?: ProblemDetails;

  constructor(code: string, status: number, detail: string, retryable = false, body?: ProblemDetails) {
    super(detail || code);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.detail = detail;
    this.retryable = retryable;
    this.title = body?.title;
    this.errors = body?.errors;
    this.requestId = body?.request_id;
    this.body = body;
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}

const RAW_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '/api/v1';

/** 브라우저에서는 상대 경로, Node(테스트)에서는 절대 경로가 필요하다. */
export function apiUrl(path: string): string {
  const base = RAW_BASE.replace(/\/$/, '');
  const full = path.startsWith('http') ? path : `${base}${path.startsWith('/') ? path : `/${path}`}`;
  if (full.startsWith('http')) return full;
  const origin = typeof window === 'undefined' ? 'http://localhost' : window.location.origin;
  return `${origin}${full}`;
}

let currentWorkspaceId: string | null = null;
export function setWorkspaceId(id: string | null) {
  currentWorkspaceId = id;
}
export function getWorkspaceId() {
  return currentWorkspaceId;
}

type Query = Record<string, string | number | boolean | null | undefined | (string | number)[]>;

export interface RequestOptions {
  query?: Query;
  body?: unknown;
  headers?: Record<string, string>;
  /** 낙관적 잠금 버전. 보내면 `If-Match` 헤더가 붙는다. */
  ifMatch?: string | number;
  signal?: AbortSignal;
}

export function buildQuery(query?: Query): string {
  if (!query) return '';
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === '') continue;
    if (Array.isArray(v)) v.forEach((x) => sp.append(k, String(x)));
    else sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

/**
 * 개발 확인용: 페이지 URL에 `?mock_error=MOA-XXX-000`이 있으면 API 요청에도 붙여 목 API가 그 오류를 돌려주게 한다.
 * `mock_error_path=/agents`를 함께 주면 그 경로로 시작하는 요청에만 붙는다.
 */
function mockErrorQuery(path: string): Query | undefined {
  if (typeof window === 'undefined' || process.env.NEXT_PUBLIC_API_MOCKING !== 'enabled') return undefined;
  const sp = new URLSearchParams(window.location.search);
  const code = sp.get('mock_error');
  if (!code) return undefined;
  const only = sp.get('mock_error_path');
  if (only && !path.startsWith(only)) return undefined;
  return { mock_error: code };
}

export async function request<T>(method: string, path: string, opts: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json', ...opts.headers };
  if (currentWorkspaceId) headers['X-Workspace-Id'] = currentWorkspaceId;
  if (opts.ifMatch !== undefined) headers['If-Match'] = String(opts.ifMatch);
  let body: BodyInit | undefined;
  if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }
  const url = apiUrl(path) + buildQuery({ ...opts.query, ...mockErrorQuery(path) });

  let res: Response;
  try {
    res = await fetch(url, { method, headers, body, signal: opts.signal, credentials: 'include' });
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') throw e;
    throw new ApiError('NETWORK', 0, '서버에 연결하지 못했습니다. 네트워크를 확인해 주세요.', true);
  }

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  const data = text ? safeJson(text) : undefined;

  if (!res.ok) {
    const p = (data ?? {}) as Partial<ProblemDetails>;
    throw new ApiError(
      p.code ?? `HTTP-${res.status}`,
      res.status,
      p.detail ?? p.title ?? res.statusText ?? '요청을 처리하지 못했습니다.',
      p.retryable ?? (res.status === 429 || res.status === 503),
      { status: res.status, code: p.code ?? `HTTP-${res.status}`, ...p } as ProblemDetails,
    );
  }
  return data as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export const api = {
  get: <T>(path: string, opts?: RequestOptions) => request<T>('GET', path, opts),
  post: <T>(path: string, body?: unknown, opts?: RequestOptions) => request<T>('POST', path, { ...opts, body }),
  put: <T>(path: string, body?: unknown, opts?: RequestOptions) => request<T>('PUT', path, { ...opts, body }),
  patch: <T>(path: string, body?: unknown, opts?: RequestOptions) => request<T>('PATCH', path, { ...opts, body }),
  delete: <T>(path: string, opts?: RequestOptions) => request<T>('DELETE', path, opts),
};

/** 커서 페이지네이션 응답 (design.md 2.6.1) */
export interface Page<T> {
  items: T[];
  next_cursor: string | null;
  /** 목 API 확장: 전체 개수(탭 숫자 표시용) */
  total?: number;
}
