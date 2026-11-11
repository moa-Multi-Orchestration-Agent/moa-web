import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';
import { startTabSync } from './tab-sync';
import { setRequestPreparation } from '@/shared/lib/request-preparation';
import { createWorkerActivation } from './activate-worker';

export const worker = setupWorker(...handlers);

let started: Promise<unknown> | null = null;

export function startMockWorker() {
  startTabSync();
  started ??= worker.start({
    onUnhandledRequest: 'bypass',
    quiet: true,
    serviceWorker: { url: '/mockServiceWorker.js' },
  }).then((registration) => {
    if (registration) setRequestPreparation(createWorkerActivation(navigator.serviceWorker, registration));
    return registration;
  }).catch((error) => {
    started = null;
    throw error;
  });
  return started;
}
