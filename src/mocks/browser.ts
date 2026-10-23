import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';
import { startTabSync } from './tab-sync';

export const worker = setupWorker(...handlers);

let started: Promise<unknown> | null = null;

export function startMockWorker() {
  startTabSync();
  started ??= worker.start({
    onUnhandledRequest: 'bypass',
    quiet: true,
    serviceWorker: { url: '/mockServiceWorker.js' },
  });
  return started;
}
