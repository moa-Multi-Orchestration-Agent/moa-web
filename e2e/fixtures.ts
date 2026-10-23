import { expect, type Page } from '@playwright/test';

export const IDS = {
  docsQaWorkflow: 'f0000000-0000-4000-8000-000000000006',
  newsWorkflow: 'f0000000-0000-4000-8000-000000000002',
  conceptWorkflow: 'f0000000-0000-4000-8000-000000000001',
};

/** 앱이 목 API와 함께 뜰 때까지 기다린다(MSW 준비 → 세션 확인) */
export async function ready(page: Page) {
  await expect(page.getByText('목 API를 준비하는 중…')).toHaveCount(0, { timeout: 30_000 });
}

export async function openEditor(page: Page, id: string) {
  await page.goto(`/workflows/${id}/edit`);
  await ready(page);
  await expect(page.getByTestId('test-run')).toBeVisible({ timeout: 30_000 });
}

/** 편집기 테스트 실행: 입력 폼 → 실행 */
export async function runFromEditor(page: Page, fill?: Record<string, string>) {
  await page.getByTestId('test-run').click();
  const dialog = page.getByRole('dialog', { name: '테스트 실행' });
  await expect(dialog).toBeVisible();
  for (const [k, v] of Object.entries(fill ?? {})) await dialog.getByLabel(new RegExp(`^${k}`)).fill(v);
  await dialog.getByRole('button', { name: '실행', exact: true }).click();
}
