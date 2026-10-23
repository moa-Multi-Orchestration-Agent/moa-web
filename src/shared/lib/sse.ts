/**
 * EventSource 래퍼 (design.md 1.5.2, 3.4.3).
 * - 이벤트 타입별 구독
 * - 브라우저 자동 재연결(서버가 보낸 `id:`를 Last-Event-ID로 다시 보냄)
 * - 연속 3회 실패하면 연결을 닫고 2초 간격 폴링으로 전환
 */
import { apiUrl, buildQuery, getWorkspaceId } from './api-client';

export type SseStatus = 'connecting' | 'open' | 'reconnecting' | 'polling' | 'closed';

export interface SseOptions<E extends object> {
  /** 이벤트 이름 → 처리 함수 */
  handlers: { [K in keyof E]?: (data: E[K], meta: { id: string | null }) => void };
  /** 상태 변화 알림(재연결 배너 등) */
  onStatus?: (status: SseStatus) => void;
  /** 폴링 모드에서 2초마다 호출. false를 돌려주면 폴링을 멈춘다(종단 상태). */
  poll?: () => Promise<boolean | void>;
  maxFailures?: number;
  pollIntervalMs?: number;
}

export interface SseConnection {
  close: () => void;
  readonly status: SseStatus;
}

export const SSE_MAX_FAILURES = 3;
export const SSE_POLL_MS = 2000;

export function connectSse<E extends object>(path: string, opts: SseOptions<E>): SseConnection {
  const maxFailures = opts.maxFailures ?? SSE_MAX_FAILURES;
  const pollMs = opts.pollIntervalMs ?? SSE_POLL_MS;
  let status: SseStatus = 'connecting';
  let failures = 0;
  let closed = false;
  let es: EventSource | null = null;
  let pollTimer: ReturnType<typeof setTimeout> | null = null;

  const setStatus = (s: SseStatus) => {
    if (status === s) return;
    status = s;
    opts.onStatus?.(s);
  };
  opts.onStatus?.(status);

  const startPolling = () => {
    es?.close();
    es = null;
    setStatus('polling');
    const tick = async () => {
      if (closed) return;
      let keepGoing: boolean | void = true;
      try {
        keepGoing = await opts.poll?.();
      } catch {
        /* 다음 주기에 다시 시도 */
      }
      if (closed) return;
      if (keepGoing === false || !opts.poll) {
        setStatus('closed');
        return;
      }
      pollTimer = setTimeout(tick, pollMs);
    };
    void tick();
  };

  // EventSource는 헤더를 못 붙이므로 워크스페이스는 쿼리로 보낸다.
  const ws = getWorkspaceId();
  const url = apiUrl(path) + buildQuery(ws ? { workspace_id: ws } : undefined);

  if (typeof EventSource === 'undefined') {
    startPolling();
  } else {
    es = new EventSource(url, { withCredentials: true });
    es.onopen = () => {
      failures = 0;
      setStatus('open');
    };
    es.onerror = () => {
      if (closed) return;
      failures += 1;
      if (failures >= maxFailures) startPolling();
      else setStatus('reconnecting');
    };
    for (const name of Object.keys(opts.handlers)) {
      es.addEventListener(name, (ev) => {
        const me = ev as MessageEvent<string>;
        let data: unknown = me.data;
        try {
          data = JSON.parse(me.data);
        } catch {
          /* 문자열 그대로 */
        }
        failures = 0;
        const handler = opts.handlers[name as keyof E];
        handler?.(data as E[keyof E], { id: me.lastEventId || null });
      });
    }
  }

  return {
    close() {
      closed = true;
      es?.close();
      if (pollTimer) clearTimeout(pollTimer);
      setStatus('closed');
    },
    get status() {
      return status;
    },
  };
}

/** SSE 본문 텍스트를 이벤트 목록으로 파싱(테스트·fetch 스트림용). */
export function parseSseChunk(text: string): { id?: string; event: string; data: string }[] {
  return text
    .split(/\n\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const out: { id?: string; event: string; data: string } = { event: 'message', data: '' };
      for (const line of block.split('\n')) {
        const idx = line.indexOf(':');
        if (idx <= 0) continue;
        const key = line.slice(0, idx);
        const value = line.slice(idx + 1).trimStart();
        if (key === 'id') out.id = value;
        else if (key === 'event') out.event = value;
        else if (key === 'data') out.data += value;
      }
      return out;
    });
}
