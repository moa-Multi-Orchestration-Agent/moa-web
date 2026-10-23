/** 목 API 공용 도우미 */

export function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** 시드용 고정 id: fid('a', 1) → 'a0000000-0000-4000-8000-000000000001' */
export function fid(prefix: string, n: number): string {
  const head = (prefix + '0000000').slice(0, 8);
  return `${head}-0000-4000-8000-${String(n).padStart(12, '0')}`;
}

export const MIN = 60_000;
export const HOUR = 60 * MIN;
export const DAY = 24 * HOUR;

export function iso(ms: number) {
  return new Date(ms).toISOString();
}
export function ago(ms: number, now = Date.now()) {
  return iso(now - ms);
}
export function nowIso() {
  return new Date().toISOString();
}

/** 결정적 의사 난수(시드 데이터가 매번 같게) */
export function seeded(seed = 42) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x1_0000_0000;
  };
}

export function randomToken(len: number, alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789') {
  let out = '';
  for (let i = 0; i < len; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

export function hex(len: number) {
  return randomToken(len, '0123456789abcdef');
}

export function sha256ish(s: string) {
  // 목 전용: 진짜 해시가 아니라 내용이 바뀌었는지만 구분하면 된다.
  let h1 = 0xdeadbeef ^ s.length;
  let h2 = 0x41c6ce57 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  return ((h2 >>> 0).toString(16) + (h1 >>> 0).toString(16)).padStart(16, '0');
}

export function countTokens(text: string) {
  const hangul = (text.match(/[ㄱ-힝]/g) ?? []).length;
  return Math.max(1, Math.ceil(hangul + (text.length - hangul) / 4));
}

export function clone<T>(v: T): T {
  return structuredClone(v);
}
