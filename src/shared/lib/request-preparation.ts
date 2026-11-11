/** 앱 진입점이 설치하는 요청 준비 훅. 실제 백엔드 모드에서는 아무 작업도 하지 않는다. */
let prepare: (() => Promise<void>) | undefined;

export function setRequestPreparation(callback: (() => Promise<void>) | undefined) {
  prepare = callback;
}

export async function prepareRequest() {
  await prepare?.();
}
