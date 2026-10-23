import { vi } from 'vitest';

/** next/navigation 대역. 테스트에서 router 호출을 확인한다. */
export const router = { push: vi.fn(), replace: vi.fn(), back: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() };
export let searchParams = new URLSearchParams();
export let pathname = '/';

export function setLocation(path: string) {
  const [p, q] = path.split('?');
  pathname = p ?? '/';
  searchParams = new URLSearchParams(q ?? '');
}

vi.mock('next/navigation', () => ({
  useRouter: () => router,
  useSearchParams: () => searchParams,
  usePathname: () => pathname,
  redirect: vi.fn(),
  notFound: vi.fn(),
}));
