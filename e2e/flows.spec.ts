import { expect, test } from '@playwright/test';
import { IDS, openEditor, ready, runFromEditor } from './fixtures';

test('1) 로그인 → 템플릿 선택 → 노드 추가 → 테스트 실행 → 성공', async ({ page }) => {
  await page.goto('/login');
  await ready(page);
  await page.getByLabel('이메일').fill('e2e@moa.dev');
  await page.getByLabel('비밀번호').fill('password123');
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await expect(page).toHaveURL(/\/home/);

  await page.getByRole('link', { name: '템플릿', exact: true }).click();
  const card = page.getByRole('article', { name: '블로그 초안 작성' });
  await card.getByRole('button', { name: '사용하기' }).click();
  await page.getByRole('button', { name: '이 템플릿으로 시작' }).click();
  await expect(page).toHaveURL(/\/workflows\/.+\/edit/);
  await expect(page.getByTestId('test-run')).toBeVisible({ timeout: 30_000 });

  const before = await page.locator('[data-testid^="node-"]').count();
  await page.getByRole('button', { name: /^요약 노드 추가/ }).click();
  await expect(page.locator('[data-testid^="node-"]')).toHaveCount(before + 1);
  await expect(page.getByText('자동 저장됨')).toBeVisible({ timeout: 15_000 });

  await runFromEditor(page);
  await expect(page.getByText('실행 상태: succeeded')).toBeVisible({ timeout: 40_000 });
  await expect(page.locator('[data-run="ok"]').first()).toBeVisible();
});

test('2) 에이전트 생성 → 스킬·워크플로 연결 → 테스트 채팅 → 배포 → API 키 → 플레이그라운드 호출', async ({ page }) => {
  await page.goto('/studio/new?type=agent&start=blank');
  await ready(page);
  await page.getByLabel('이름').fill('E2E 비서 에이전트');
  await page.getByRole('button', { name: /만들기/ }).click();
  await expect(page).toHaveURL(/\/agents\/[0-9a-f-]+$/);

  await page.getByRole('button', { name: '스킬 추가' }).click();
  await page.getByRole('button', { name: '웹 검색 추가' }).click();
  await page.getByRole('button', { name: '완료' }).click();
  await page.getByRole('button', { name: '워크플로 연결' }).click();
  const dlg = page.getByRole('dialog', { name: '워크플로 연결' });
  await dlg.getByRole('combobox', { name: '워크플로' }).click();
  await page.getByRole('option', { name: '사내 문서 Q&A' }).click();
  await dlg.getByRole('button', { name: '연결' }).click();
  await page.getByTestId('agent-save').click();
  await expect(page.getByText('에이전트를 저장했습니다.')).toBeVisible();

  await page.getByRole('textbox', { name: '테스트 메시지 입력' }).fill('연차 규정 알려줘');
  await page.getByRole('button', { name: '보내기', exact: true }).click();
  await expect(page.getByText(/E2E 비서 에이전트입니다/)).toBeVisible({ timeout: 30_000 });

  await page.getByTestId('agent-deploy-button').click();
  await expect(page.getByRole('dialog', { name: '새 배포' })).toBeVisible();
  await page.getByLabel('슬러그').fill('e2e-assistant');
  await expect(page.getByText('사용할 수 있어요')).toBeVisible();
  await page.getByTestId('deploy-submit').click();
  await expect(page).toHaveURL(/\/deploy\/[0-9a-f-]+$/);

  await page.getByRole('tab', { name: '플레이그라운드' }).click();
  await page.getByRole('button', { name: '테스트 키 발급' }).click();
  await expect(page.getByLabel('API 키')).toHaveValue(/^moa_live_/);
  await page.getByTestId('playground-call').click();
  await expect(page.getByTestId('playground-result')).toContainText('HTTP 200', { timeout: 30_000 });
  await expect(page.getByTestId('playground-result')).toContainText('succeeded');
});

test('3) 승인 노드 실행 → 승인 대기 → 승인 → 완료', async ({ page }) => {
  await openEditor(page, IDS.newsWorkflow);
  await runFromEditor(page);
  await expect(page.getByTestId('console-approve')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('[data-run="waiting"]')).toHaveCount(1);
  await page.getByTestId('console-approve').click();
  await expect(page.getByText('실행 상태: succeeded')).toBeVisible({ timeout: 30_000 });
});

test('4) "fail" 입력 실행 → 실패 노드·오류 코드 → 입력 수정 후 재실행 성공', async ({ page }) => {
  await openEditor(page, IDS.docsQaWorkflow);
  await runFromEditor(page, { question: 'please fail now' });
  await expect(page.getByText('실행 상태: failed', { exact: false })).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('[data-run="error"]')).toHaveCount(1);
  await page.getByRole('link', { name: '전체 실행 기록 →' }).click();
  await expect(page.getByTestId('run-error').first()).toContainText('MOA-NODE-001');

  await page.getByTestId('rerun').click();
  const input = page.getByLabel('입력 (JSON)');
  await input.fill('{"question": "연차는 언제 생기나요?"}');
  await page.getByTestId('rerun-submit').click();
  await expect(page.getByText('새 실행을 시작했습니다.')).toBeVisible();
  await expect(page.locator('header').getByText('성공')).toBeVisible({ timeout: 30_000 });
});

test('5) 마켓 복제 라이선스 구매 → 스튜디오에 복제본', async ({ page }) => {
  await page.goto('/market');
  await ready(page);
  await page.getByRole('link', { name: '논문 요약 · 인용 정리 상세' }).click();
  await page.getByTestId('buy').click();
  await page.getByTestId('pay').click();
  await expect(page.getByTestId('purchase-done')).toBeVisible({ timeout: 20_000 });
  await page.keyboard.press('Escape');
  await page.getByRole('link', { name: '스튜디오', exact: true }).click();
  await page.getByRole('tab', { name: /워크플로/ }).click();
  await expect(page.getByRole('link', { name: '논문 요약 · 인용 정리' })).toBeVisible();
});

test('6) 같은 워크플로를 두 페이지에서 편집 → 충돌 다이얼로그 → 서버 것 불러오기', async ({ context }) => {
  const a = await context.newPage();
  const b = await context.newPage();
  await openEditor(a, IDS.docsQaWorkflow);
  await openEditor(b, IDS.docsQaWorkflow);

  // B가 먼저 저장
  await b.getByTestId('node-llm1').click();
  await b.getByTestId('inspector').getByLabel('이름').fill('B가 바꾼 이름');
  await expect(b.getByText('자동 저장됨')).toBeVisible({ timeout: 15_000 });

  // A는 예전 버전으로 저장 → 409
  await a.getByTestId('node-rag').click();
  await a.getByTestId('inspector').getByLabel('이름').fill('A가 바꾼 이름');
  const dialog = a.getByRole('dialog', { name: '다른 곳에서 먼저 저장했습니다' });
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  await expect(dialog.getByTestId('conflict-summary')).toContainText('설정이 다른 노드');
  await dialog.getByRole('button', { name: '서버 것 불러오기' }).click();
  await expect(dialog).toBeHidden();
  await expect(a.getByTestId('node-llm1')).toContainText('B가 바꾼 이름');
  await expect(a.getByTestId('node-rag')).not.toContainText('A가 바꾼 이름');
});

test('7) 뷰어 워크스페이스 → 삭제·배포 버튼 비활성', async ({ page }) => {
  await page.goto('/studio');
  await ready(page);
  await page.getByRole('button', { name: '워크스페이스 전환' }).click();
  await page.getByTestId('ws-partner-studio').click();
  await expect(page.getByText('파트너 상담 에이전트')).toBeVisible();
  await expect(page.getByTestId('agent-deploy')).toBeDisabled();
  await page.getByRole('button', { name: '파트너 상담 에이전트 메뉴' }).click();
  await expect(page.getByRole('menuitem', { name: /삭제/ })).toHaveAttribute('data-disabled', '');
  await page.keyboard.press('Escape');
  await page.getByRole('link', { name: '배포·API' }).click();
  await expect(page.getByTestId('new-deploy')).toBeDisabled();
});
