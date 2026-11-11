'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { workflowKeys, type WorkflowDetail, type WorkflowDetailRow } from '@/entities/workflow';
import { api, getWorkspaceId } from '@/shared/lib/api-client';
import { Button } from '@/shared/ui/button';
import { toDefinition } from './convert';
import { MISSING_WORKFLOW_MESSAGE } from './save-recovery';
import { useEditorStore } from './store';

/** 삭제되거나 초기화된 원본은 되살리지 않고, 남은 초안을 새 항목으로 저장한다. */
export function RecoverWorkflow({ wf }: { wf: WorkflowDetail }) {
  const error = useEditorStore((s) => s.saveError);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const router = useRouter();
  const qc = useQueryClient();
  if (error !== MISSING_WORKFLOW_MESSAGE) return null;

  const recover = async () => {
    if (pending.current) return;
    const state = useEditorStore.getState();
    if (state.workflowId !== wf.id) return;
    const workspace = getWorkspaceId();
    const draft = toDefinition(state.nodes, state.edges);
    const sent = JSON.stringify(draft);
    pending.current = true;
    setBusy(true);
    try {
      const restored = await api.post<WorkflowDetailRow>('/workflows', { name: wf.name, description: wf.description, draft });
      if (getWorkspaceId() !== workspace || useEditorStore.getState().workflowId !== wf.id) return;
      qc.setQueryData(workflowKeys.detail(restored.id), restored);
      // 요청 도중 추가한 변경도 유지하고 새 ID에 이어서 저장한다.
      const current = useEditorStore.getState();
      useEditorStore.setState({ workflowId: restored.id, serverVersion: restored.draft_version, dirty: JSON.stringify(toDefinition(current.nodes, current.edges)) !== sent, saveStatus: 'saved', saveError: null, lastSavedAt: Date.now(), conflict: null });
      void qc.invalidateQueries({ queryKey: workflowKeys.all, refetchType: 'none' });
      toast.dismiss('autosave-error');
      toast.success('현재 내용을 새 워크플로로 복구했습니다.');
      router.replace(`/workflows/${restored.id}/edit`);
    } catch (e) {
      toast.error('복구하지 못했습니다. 화면의 작업은 유지됩니다.', { description: (e as Error).message });
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };

  return <Button size="sm" variant="outline" disabled={busy} onClick={() => void recover()}>{busy ? '복구 중…' : '현재 내용 복구'}</Button>;
}
