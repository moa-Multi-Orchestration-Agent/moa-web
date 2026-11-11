import { afterEach, expect, it, vi } from 'vitest';
import { createWorkerActivation } from './activate-worker';

afterEach(() => vi.useRealTimers());

function fixture() {
  const container = new EventTarget() as ServiceWorkerContainer;
  const worker = { postMessage: vi.fn() } as unknown as ServiceWorker;
  const activate = createWorkerActivation(container, { active: worker } as ServiceWorkerRegistration);
  const reply = (source = worker) => container.dispatchEvent(new MessageEvent('message', { source: source as unknown as MessageEventSource, data: { type: 'MOCKING_ENABLED' } }));
  return { activate, reply, worker, container };
}

it('동시 요청은 한 번 확인하고, 다음 요청은 워커 활성화를 다시 확인한다', async () => {
  const { activate, reply, worker } = fixture();
  const first = activate();
  expect(activate()).toBe(first);
  expect(worker.postMessage).toHaveBeenCalledTimes(1);
  reply();
  await first;
  const next = activate();
  expect(worker.postMessage).toHaveBeenCalledTimes(2);
  reply();
  await next;
});

it('다른 워커의 응답은 무시하며 타임아웃 후 다시 시도할 수 있다', async () => {
  vi.useFakeTimers();
  const { activate, reply, worker } = fixture();
  const first = activate();
  const rejected = expect(first).rejects.toThrow('응답 시간이 초과');
  reply({} as ServiceWorker);
  await vi.advanceTimersByTimeAsync(5000);
  await rejected;
  const next = activate();
  reply();
  await next;
  expect(worker.postMessage).toHaveBeenCalledTimes(2);
});
