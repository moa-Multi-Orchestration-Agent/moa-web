import { act, waitFor } from '@testing-library/react';
import { http } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { server } from '@/mocks/server';
import { resetDb } from '@/mocks/db';
import { WS1 } from '@/mocks/fixtures';
import { problem } from '@/mocks/lib/http';
import { setWorkspaceId } from '@/shared/lib/api-client';
import { renderHookWithQuery } from '@/test/render';
import { useAgents, useUpdateAgent } from './api';

beforeEach(() => {
  resetDb();
  setWorkspaceId(WS1);
});

describe('agent 훅', () => {
  it('목록을 UI 모델(camelCase)로 돌려준다', async () => {
    const { result } = renderHookWithQuery(() => useAgents({ limit: 3 }));
    await waitFor(() => expect(result.current.items).toHaveLength(3));
    expect(result.current.items[0]).toHaveProperty('updatedAt');
    expect(result.current.hasNextPage).toBe(true);
  });

  it('수정 실패하면 낙관적 변경을 되돌린다', async () => {
    const { result } = renderHookWithQuery(() => ({ list: useAgents({ limit: 50 }), update: useUpdateAgent() }));
    await waitFor(() => expect(result.current.list.items.length).toBeGreaterThan(0));
    const target = result.current.list.items[0]!;
    server.use(http.patch('*/api/v1/agents/:id', () => problem('MOA-SYS-500')));
    await act(async () => {
      await result.current.update.mutateAsync({ id: target.id, name: '바뀐 이름' }).catch(() => {});
    });
    await waitFor(() => expect(result.current.list.items.find((a) => a.id === target.id)?.name).toBe(target.name));
  });
});
