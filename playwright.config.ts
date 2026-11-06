import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 3100);
/** E2E_REAL=1 이면 목 API 대신 실제 백엔드(../moa-backend, uv run moa)에 붙여 돌린다. */
const REAL = process.env.E2E_REAL === '1';
const BACKEND_PORT = Number(process.env.E2E_BACKEND_PORT ?? 8000);

export default defineConfig({
  testDir: './e2e',
  globalSetup: REAL ? './e2e/global-setup.ts' : undefined,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 2,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    viewport: { width: 1440, height: 900 },
    locale: 'ko-KR',
    storageState: REAL ? 'e2e/.auth/demo.json' : undefined,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
  webServer: [
    ...(REAL
      ? [
          {
            command: `uv run moa --port ${BACKEND_PORT}`,
            cwd: '../moa-backend',
            url: `http://localhost:${BACKEND_PORT}/readyz`,
            reuseExistingServer: !process.env.CI,
            timeout: 120_000,
          },
        ]
      : []),
    {
      command: `pnpm build && pnpm start -p ${PORT}`,
      url: `http://localhost:${PORT}/login`,
      reuseExistingServer: !process.env.CI,
      timeout: 300_000,
      env: REAL
        ? { NEXT_PUBLIC_API_MOCKING: '', NEXT_DIST_DIR: '.next-e2e-real', MOA_BACKEND_URL: `http://localhost:${BACKEND_PORT}` }
        : { NEXT_PUBLIC_API_MOCKING: 'enabled', NEXT_DIST_DIR: '.next-e2e' },
    },
  ],
});
