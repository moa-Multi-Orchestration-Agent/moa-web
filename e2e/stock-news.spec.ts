import { test, expect } from '@playwright/test';

test('저장된 최신 JSON으로 카드 5장을 자동 표시하고 JPEG를 내려받는다', async ({ page }) => {
  test.skip(process.env.STOCK_NEWS_PREVIEW !== '1', '실제 API 계약으로 만든 테스트 수집본 서버가 필요합니다.');
  await page.goto('/login');
  await page.getByLabel('이메일', { exact: true }).fill('demo@moa.dev');
  await page.getByLabel('비밀번호', { exact: true }).fill('moa1234');
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await expect(page).toHaveURL(/\/home/);
  await page.getByRole('link', { name: '국내 주식 카드뉴스', exact: true }).click();
  const images = page.getByRole('img', { name: /국내 주식 뉴스 카드/ });
  await expect(images).toHaveCount(5);
  await expect.poll(() => images.first().evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(1080);
  expect(await images.first().evaluate((image: HTMLImageElement) => image.naturalHeight)).toBe(1350);
  await expect(page.getByRole('link', { name: /원문 보기/ })).toHaveCount(4);
  const downloaded = page.waitForEvent('download');
  await page.getByRole('link', { name: 'JPEG 저장', exact: true }).first().click();
  const file = await downloaded;
  expect(file.suggestedFilename()).toMatch(/stock-news-.*-1\.jpg$/);
  await file.saveAs('tmp/stock-news-cover.jpg');
  await page.screenshot({ path: 'tmp/stock-news-gallery.png', fullPage: true });
});
