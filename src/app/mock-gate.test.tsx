import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { startMockWorker } from '@/mocks/browser';
import { MockGate } from './mock-gate';

vi.mock('@/mocks/browser', () => ({ startMockWorker: vi.fn() }));

it('워커 시작에 실패하면 앱을 열지 않고 다시 시도할 수 있다', async () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.mocked(startMockWorker).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(undefined);
  render(<MockGate><div>앱 내용</div></MockGate>);
  await screen.findByRole('alert');
  expect(screen.queryByText('앱 내용')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
  await waitFor(() => expect(screen.getByText('앱 내용')).toBeInTheDocument());
  log.mockRestore();
});
