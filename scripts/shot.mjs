// 화면 스크린샷: node scripts/shot.mjs <출력폴더> <경로> [<경로> ...]
// 옵션: BASE_URL(기본 http://localhost:3000), WIDTH(1440), HEIGHT(900), THEME(light|dark), WAIT(ms)
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const [outDir, ...paths] = process.argv.slice(2);
if (!outDir || paths.length === 0) {
  console.error('사용법: node scripts/shot.mjs <출력폴더> <경로...>');
  process.exit(1);
}
const base = process.env.BASE_URL ?? 'http://localhost:3000';
const width = Number(process.env.WIDTH ?? 1440);
const height = Number(process.env.HEIGHT ?? 900);
const wait = Number(process.env.WAIT ?? 1500);
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width, height }, colorScheme: process.env.THEME === 'dark' ? 'dark' : 'light', locale: 'ko-KR' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`${page.url()} ${e.message}`));
page.on('console', (m) => m.type() === 'error' && errors.push(`${page.url()} console: ${m.text()}`));
for (const p of paths) {
  await page.goto(base + p, { waitUntil: 'load', timeout: 120_000 });
  await page.waitForTimeout(wait);
  const name = p.replace(/^\//, '').replace(/[/?=&]/g, '_') || 'root';
  await page.screenshot({ path: join(outDir, `${name}.png`) });
  console.log('saved', join(outDir, `${name}.png`));
}
if (errors.length) console.log('ERRORS:\n' + errors.join('\n'));
await browser.close();
