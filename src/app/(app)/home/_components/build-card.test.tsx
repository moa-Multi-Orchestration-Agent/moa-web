import '@/test/next-navigation';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { db, resetDb } from '@/mocks/db';
import { WS1 } from '@/mocks/fixtures';
import { setWorkspaceId } from '@/shared/lib/api-client';
import { useCurrentWorkspaceStore } from '@/entities/workspace';
import { router } from '@/test/next-navigation';
import { renderWithQuery } from '@/test/render';
import { BuildCard } from './build-card';

beforeEach(() => {
  resetDb();
  setWorkspaceId(WS1);
  useCurrentWorkspaceStore.setState({ id: WS1 });
  router.push.mockClear();
});

describe('BuildCard', () => {
  it('설명이 비면 안내 문구', async () => {
    renderWithQuery(<BuildCard />);
    await waitFor(() => expect(screen.getByRole('button', { name: /설명으로 초안 만들기/ })).toBeEnabled());
    await userEvent.click(screen.getByRole('button', { name: /설명으로 초안 만들기/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('한 문장 이상');
  });

  it('설명과 맞는 템플릿으로 초안을 만들고 빌더로 이동', async () => {
    renderWithQuery(<BuildCard />);
    await userEvent.type(screen.getByLabelText('만들고 싶은 것 설명'), '회의록을 요약해서 Notion에 정리하는 에이전트를 만들어줘');
    const before = db.agents.length;
    await waitFor(() => expect(screen.getByRole('button', { name: /설명으로 초안 만들기/ })).toBeEnabled());
    await userEvent.click(screen.getByRole('button', { name: /설명으로 초안 만들기/ }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith(expect.stringMatching(/^\/agents\//)));
    expect(db.agents.length).toBe(before + 1);
    expect(db.agents.at(-1)!.name).toContain('회의록');
  });
});
