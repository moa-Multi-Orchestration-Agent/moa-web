import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { ApiError } from '@/shared/lib/api-client';
import { saveDraft, validateWorkflow } from '@/entities/workflow';
import { useAutosave } from './autosave';
import { useEditorStore } from './store';
import { MISSING_WORKFLOW_MESSAGE } from './save-recovery';

vi.mock('@/entities/workflow', async (original) => ({ ...await original<object>(), saveDraft: vi.fn(), validateWorkflow: vi.fn() }));
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  useEditorStore.getState().init({ id: 'wf', draft: { nodes: [], edges: [] }, draft_version: 2 });
  useEditorStore.setState({ dirty: true });
  vi.mocked(validateWorkflow).mockResolvedValue({ issues: [], order: [] });
});
afterEach(() => vi.useRealTimers());

function mount() {
  const qc = new QueryClient();
  return renderHook(() => useAutosave('wf', true), { wrapper: ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider> });
}
const tick = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

it('404는 초안을 보존하고 자동 재시도를 멈추며 수동 재시도는 허용한다', async () => {
  vi.mocked(saveDraft).mockRejectedValue(new ApiError('HTTP-404', 404, 'Not Found'));
  const hook = mount();
  await tick(1600);
  expect(useEditorStore.getState()).toMatchObject({ dirty: true, saveStatus: 'error', saveError: MISSING_WORKFLOW_MESSAGE });
  await tick(20000);
  expect(saveDraft).toHaveBeenCalledTimes(1);
  vi.mocked(saveDraft).mockResolvedValue({ draft_version: 3, issues: [] });
  await act(async () => hook.result.current.saveNow());
  expect(useEditorStore.getState()).toMatchObject({ dirty: false, saveStatus: 'saved', serverVersion: 3 });
  hook.unmount();
});

it('503은 재시도 후 정상 저장한다', async () => {
  vi.mocked(saveDraft).mockRejectedValueOnce(new ApiError('HTTP-503', 503, 'Unavailable')).mockResolvedValue({ draft_version: 3, issues: [] });
  const hook = mount();
  await tick(1600);
  await tick(5000);
  expect(saveDraft).toHaveBeenCalledTimes(2);
  expect(useEditorStore.getState().saveStatus).toBe('saved');
  hook.unmount();
});

it('403은 자동 재시도하지 않는다', async () => {
  vi.mocked(saveDraft).mockRejectedValue(new ApiError('FORBIDDEN', 403, '권한 없음'));
  const hook = mount();
  await tick(1600);
  await tick(20000);
  expect(saveDraft).toHaveBeenCalledTimes(1);
  hook.unmount();
});

it('화면을 떠난 뒤 끝난 요청은 재시도를 예약하지 않는다', async () => {
  let reject!: (e: Error) => void;
  vi.mocked(saveDraft).mockImplementation(() => new Promise((_, fail) => { reject = fail; }));
  const hook = mount();
  await tick(1600);
  hook.unmount();
  await act(async () => reject(new ApiError('NETWORK', 0, 'offline')));
  await tick(20000);
  expect(saveDraft).toHaveBeenCalledTimes(1);
});
