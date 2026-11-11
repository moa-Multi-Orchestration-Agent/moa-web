/**
 * MSW 2의 워커는 활성 탭 ID를 워커 메모리에만 보관한다.
 * 브라우저가 유휴 워커를 종료하면 start()의 캐시와 달리 이 목록은 사라진다.
 * 생성된 mockServiceWorker.js의 MOCK_ACTIVATE/MOCKING_ENABLED handshake를
 * 요청 전에 수행한다. fetch 자체를 재전송하지 않아 POST가 중복 실행되지 않는다.
 */
export function createWorkerActivation(container: ServiceWorkerContainer, registration: ServiceWorkerRegistration) {
  let pending: Promise<void> | undefined;
  return () => {
    pending ??= new Promise<void>((resolve, reject) => {
      const worker = container.controller ?? registration.active;
      if (!worker) {
        reject(new Error('목 API 워커가 연결되지 않았습니다.'));
        return;
      }
      const cleanup = () => {
        clearTimeout(timeout);
        container.removeEventListener('message', onMessage);
      };
      const onMessage = (event: MessageEvent) => {
        if (event.source !== worker || event.data?.type !== 'MOCKING_ENABLED') return;
        cleanup();
        event.ports[0]?.postMessage({});
        resolve();
      };
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error('목 API 워커 응답 시간이 초과되었습니다.'));
      }, 5000);
      container.addEventListener('message', onMessage);
      try {
        worker.postMessage('MOCK_ACTIVATE');
      } catch (error) {
        cleanup();
        reject(error);
      }
    }).finally(() => { pending = undefined; });
    return pending;
  };
}
