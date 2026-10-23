import { expect, test } from '@playwright/test';

test('홈 화면이 열린다', async ({ page }) => {
  await page.goto('/home');
  await expect(page.getByRole('navigation', { name: '주 메뉴' }).or(page.getByLabel('주 메뉴'))).toBeVisible();
});
