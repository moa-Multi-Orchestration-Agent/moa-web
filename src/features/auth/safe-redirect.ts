/** 로그인 후 돌아갈 경로. 외부 주소·프로토콜 상대 주소(//)는 막는다. */
export function safeRedirect(raw: string | null | undefined, fallback = '/home'): string {
  if (!raw) return fallback;
  let v = raw;
  try {
    v = decodeURIComponent(raw);
  } catch {
    return fallback;
  }
  if (!v.startsWith('/') || v.startsWith('//') || v.startsWith('/\\')) return fallback;
  if (v.startsWith('/login') || v.startsWith('/signup')) return fallback;
  return v;
}

export function loginHref(pathWithSearch: string) {
  return `/login?redirect=${encodeURIComponent(pathWithSearch)}`;
}
