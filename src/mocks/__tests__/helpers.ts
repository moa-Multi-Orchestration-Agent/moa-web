import { api, apiUrl, setWorkspaceId, type ApiError } from '@/shared/lib/api-client';
import { parseSseChunk } from '@/shared/lib/sse';
import { resetDb } from '../db';
import { WS1, WS2 } from '../fixtures';
import { resetSimulator } from '../simulator';

export { api, WS1, WS2 };

export function fresh(ws: string = WS1) {
  resetDb();
  resetSimulator();
  setWorkspaceId(ws);
}

export async function fail(p: Promise<unknown>): Promise<ApiError> {
  try {
    await p;
  } catch (e) {
    return e as ApiError;
  }
  throw new Error('요청이 실패해야 하는데 성공했습니다');
}

/** SSE 스트림을 끝까지(또는 timeout까지) 읽어 이벤트 목록으로 */
export async function readEvents(runId: string, opts: { lastEventId?: number; untilEvent?: (e: { event: string; data: string }) => boolean; timeoutMs?: number } = {}) {
  const headers: Record<string, string> = { 'X-Workspace-Id': WS1 };
  if (opts.lastEventId) headers['Last-Event-ID'] = String(opts.lastEventId);
  const res = await fetch(apiUrl(`/runs/${runId}/events`), { headers });
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let text = '';
  const deadline = Date.now() + (opts.timeoutMs ?? 5000);
  for (;;) {
    const left = deadline - Date.now();
    if (left <= 0) break;
    const r = await Promise.race([reader.read(), new Promise<{ done: true; value?: undefined }>((ok) => setTimeout(() => ok({ done: true }), left))]);
    if (r.done) break;
    text += dec.decode(r.value);
    if (opts.untilEvent && parseSseChunk(text).some(opts.untilEvent)) break;
  }
  void reader.cancel().catch(() => {});
  return parseSseChunk(text).filter((e) => e.event !== 'message');
}

export async function waitFor(fn: () => Promise<boolean> | boolean, timeoutMs = 4000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await fn()) return;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error('시간 초과');
}
