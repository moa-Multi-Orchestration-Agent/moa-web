/**
 * TanStack Query 규칙
 * - 키: [엔티티, 워크스페이스 id, 'list' | 'detail' | …, 파라미터] — 워크스페이스를 바꾸면 키가 달라져 자동으로 다시 불러온다.
 * - 무효화는 [엔티티] 접두어로 한다(모든 워크스페이스 캐시를 함께 지움).
 * - 수정 훅은 onMutate에서 캐시를 먼저 바꾸고, 실패하면 onError에서 되돌린다.
 */
import type { InfiniteData, QueryClient, QueryKey } from '@tanstack/react-query';
import { getWorkspaceId, type Page } from './api-client';

export const wsKey = () => getWorkspaceId() ?? '_';

export function flattenPages<T>(data: InfiniteData<Page<T>> | undefined): T[] {
  return data?.pages.flatMap((p) => p.items) ?? [];
}

type Snapshot = [QueryKey, unknown][];

/** 접두어에 걸리는 모든 캐시(목록·무한 목록·상세)에서 id가 같은 항목을 바꾼다. 되돌리기용 스냅샷을 돌려준다. */
export function patchEverywhere<T extends { id: string }>(
  qc: QueryClient,
  prefix: QueryKey,
  id: string,
  patch: (item: T) => T | null,
): Snapshot {
  const snap = qc.getQueriesData({ queryKey: prefix });
  for (const [key, data] of snap) {
    if (!data) continue;
    qc.setQueryData(key, patchData(data, id, patch));
  }
  return snap;
}

function patchData<T extends { id: string }>(data: unknown, id: string, patch: (item: T) => T | null): unknown {
  if (Array.isArray(data)) return data.map((x) => (x?.id === id ? patch(x) : x)).filter((x) => x !== null);
  if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>;
    if (Array.isArray(d.pages)) return { ...d, pages: (d.pages as unknown[]).map((p) => patchData(p, id, patch)) };
    if (Array.isArray(d.items)) return { ...d, items: patchData(d.items, id, patch) };
    if (d.id === id) return patch(d as unknown as T) ?? d;
  }
  return data;
}

export function restore(qc: QueryClient, snap: Snapshot | undefined) {
  if (!snap) return;
  for (const [key, data] of snap) qc.setQueryData(key, data);
}
