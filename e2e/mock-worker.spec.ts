import { test, expect } from '@playwright/test';

test('워커가 종료되어도 템플릿 생성과 초안 저장을 복구한다', async ({ page, context }) => {
  test.skip(process.env.E2E_REAL === '1', '목 API 워커 전용 회귀 테스트');
  const templates = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/v1/templates' && r.request().method() === 'GET');
  await page.goto('/studio/new?type=workflow');
  await (await templates).finished();
  await page.getByLabel('이름', { exact: true }).fill('주식 카드뉴스 인스타 업로드');
  await page.getByLabel('한 줄 설명').fill('국내 주식 뉴스 요약 뉴스레터');
  const cdp = await context.newCDPSession(page);
  await cdp.send('ServiceWorker.enable');
  await cdp.send('ServiceWorker.stopAllWorkers');
  const created = page.waitForResponse((r) => r.url().includes('/templates/') && r.url().endsWith('/instantiate') && r.request().method() === 'POST');
  await page.getByRole('button', { name: '만들기', exact: true }).click();
  expect((await created).ok()).toBe(true);
  await expect(page).toHaveURL(/\/workflows\/[^/]+\/edit/);
  await expect(page.getByLabel('워크플로 이름')).toHaveValue('주식 카드뉴스 인스타 업로드');
  await expect(page.locator('.react-flow__renderer')).toHaveCSS('position', 'absolute');
  await expect(page.locator('.react-flow__minimap')).toHaveCSS('position', 'absolute');
  await expect(page.locator('.react-flow__controls')).toHaveCSS('position', 'absolute');
  await cdp.send('ServiceWorker.stopAllWorkers');
  const updated = page.waitForResponse((r) => /\/api\/v1\/workflows\/[^/]+$/.test(new URL(r.url()).pathname) && r.request().method() === 'PATCH');
  await page.getByLabel('워크플로 이름').fill('주식 카드뉴스 저장 확인');
  await page.getByLabel('워크플로 이름').press('Enter');
  expect((await updated).ok()).toBe(true);
  // 편집기 노드를 이동해 자동 저장도 확인한다.
  await cdp.send('ServiceWorker.stopAllWorkers');
  const saved = page.waitForResponse((r) => r.url().endsWith('/draft') && r.request().method() === 'PUT');
  const node = page.locator('.react-flow__node').first();
  await node.click();
  await node.press('ArrowRight');
  expect((await saved).ok()).toBe(true);
  await expect(page.getByText(/자동 저장됨/)).toBeVisible();
  await page.screenshot({ path: 'tmp/mock-worker-fixed.png' });
});
