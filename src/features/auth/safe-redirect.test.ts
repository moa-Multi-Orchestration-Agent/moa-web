import { describe, expect, it } from 'vitest';
import { loginHref, safeRedirect } from './safe-redirect';

describe('safeRedirect', () => {
  it('앱 안 경로만 허용한다', () => {
    expect(safeRedirect('/studio?tab=workflows')).toBe('/studio?tab=workflows');
    expect(safeRedirect(encodeURIComponent('/runs/1'))).toBe('/runs/1');
    expect(safeRedirect('https://evil.com')).toBe('/home');
    expect(safeRedirect('//evil.com')).toBe('/home');
    expect(safeRedirect('/login')).toBe('/home');
    expect(safeRedirect(null)).toBe('/home');
  });
  it('loginHref는 현재 경로를 담는다', () => {
    expect(loginHref('/agents/1?tab=test')).toBe('/login?redirect=%2Fagents%2F1%3Ftab%3Dtest');
  });
});
