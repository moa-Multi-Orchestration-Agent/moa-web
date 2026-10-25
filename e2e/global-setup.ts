import { mkdirSync } from 'node:fs';
import { request, type FullConfig } from '@playwright/test';

/** 실제 백엔드 모드: 데모 계정으로 한 번 로그인해 세션 쿠키를 저장한다(목 모드는 항상 로그인 상태). */
export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]!.use.baseURL!;
  const ctx = await request.newContext({ baseURL });
  const res = await ctx.post('/api/v1/auth/login', { data: { email: 'demo@moa.dev', password: 'moa1234' } });
  if (!res.ok()) throw new Error(`데모 계정 로그인 실패: ${res.status()} ${await res.text()}`);
  mkdirSync('e2e/.auth', { recursive: true });
  await ctx.storageState({ path: 'e2e/.auth/demo.json' });
  await ctx.dispose();
}
