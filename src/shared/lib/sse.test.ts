import { describe, expect, it, vi } from 'vitest';
import { connectSse, parseSseChunk } from './sse';

describe('parseSseChunk', () => {
  it('id·event·data를 읽는다', () => {
    const out = parseSseChunk('id: 3\nevent: step.started\ndata: {"node_id":"in"}\n\nevent: heartbeat\ndata: {"ts":1}\n\n');
    expect(out).toEqual([
      { id: '3', event: 'step.started', data: '{"node_id":"in"}' },
      { event: 'heartbeat', data: '{"ts":1}' },
    ]);
  });
});

describe('connectSse', () => {
  it('EventSource가 3번 실패하면 폴링으로 바꾼다', async () => {
    vi.useFakeTimers();
    const instances: FakeES[] = [];
    class FakeES {
      onopen: (() => void) | null = null;
      onerror: (() => void) | null = null;
      closed = false;
      constructor() {
        instances.push(this);
      }
      addEventListener() {}
      close() {
        this.closed = true;
      }
    }
    vi.stubGlobal('EventSource', FakeES);
    const statuses: string[] = [];
    let polls = 0;
    const conn = connectSse('/runs/1/events', {
      handlers: {},
      onStatus: (s) => statuses.push(s),
      poll: async () => {
        polls += 1;
        return polls < 3;
      },
    });
    const es = instances[0]!;
    es.onerror?.();
    es.onerror?.();
    expect(conn.status).toBe('reconnecting');
    es.onerror?.();
    expect(es.closed).toBe(true);
    expect(conn.status).toBe('polling');
    await vi.advanceTimersByTimeAsync(4100);
    expect(polls).toBe(3);
    expect(statuses.at(-1)).toBe('closed');
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });
});
