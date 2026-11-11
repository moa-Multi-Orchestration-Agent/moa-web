import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, expect, it, vi } from 'vitest';
import { toWorkflowDetail } from '@/entities/workflow';
import { db } from '@/mocks/db';
import { fresh } from '@/mocks/__tests__/helpers';
import { workflowDetailView } from '@/mocks/views';
import { RecoverWorkflow } from './recover-workflow';
import { toDefinition } from './convert';
import { MISSING_WORKFLOW_MESSAGE } from './save-recovery';
import { useEditorStore } from './store';

const replace = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), dismiss: vi.fn() } }));
beforeEach(() => { fresh(); vi.clearAllMocks(); });

it('사라진 워크플로의 화면 초안을 새 ID로 저장하고 자동 저장 대상을 전환한다', async () => {
  const original = db.workflows[0]!;
  const row = workflowDetailView(original);
  useEditorStore.getState().init(row);
  const nodeId = useEditorStore.getState().nodes[0]!.id;
  useEditorStore.getState().updateNode(nodeId, { name: '아침 7시 국내 주식 뉴스' });
  const draft = toDefinition(useEditorStore.getState().nodes, useEditorStore.getState().edges);
  useEditorStore.getState().markSaveError(MISSING_WORKFLOW_MESSAGE);
  db.workflows.splice(db.workflows.indexOf(original), 1);
  render(<QueryClientProvider client={new QueryClient()}><RecoverWorkflow wf={toWorkflowDetail(row)} /></QueryClientProvider>);
  fireEvent.click(screen.getByRole('button', { name: '현재 내용 복구' }));
  await waitFor(() => expect(replace).toHaveBeenCalledTimes(1));
  const state = useEditorStore.getState();
  expect(state.workflowId).not.toBe(original.id);
  const restored = db.workflows.find((w) => w.id === state.workflowId)!;
  expect(restored.name).toBe(original.name);
  expect(restored.draft).toEqual(draft);
  expect(state).toMatchObject({ dirty: false, saveStatus: 'saved', saveError: null, serverVersion: 1 });
  expect(replace).toHaveBeenCalledWith(`/workflows/${restored.id}/edit`);
});
