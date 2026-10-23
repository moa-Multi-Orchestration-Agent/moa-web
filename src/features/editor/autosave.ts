'use client';

/**
 * 자동 저장 (design.md 3.4.3 ② 의사코드 그대로).
 * 변경 후 AUTOSAVE_MS 디바운스 → PUT /draft (If-Match: serverVersion).
 * 409면 서버 최신본을 받아 충돌 다이얼로그, 그 밖의 오류는 토스트 후 자동 재시도.
 */
import { useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { fetchWorkflow, saveDraft, validateWorkflow, workflowKeys } from '@/entities/workflow';
import { isApiError } from '@/shared/lib/api-client';
import { toDefinition } from './convert';
import { AUTOSAVE_MS, useEditorStore } from './store';

const RETRY_MS = 5000;

export function useAutosave(workflowId: string, enabled: boolean) {
  const qc = useQueryClient();
  const nodes = useEditorStore((s) => s.nodes);
  const edges = useEditorStore((s) => s.edges);
  const dirty = useEditorStore((s) => s.dirty);
  const conflict = useEditorStore((s) => s.conflict);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saving = useRef(false);

  const save = useCallback(async () => {
    const s = useEditorStore.getState();
    if (!enabled || saving.current || !s.dirty || s.conflict || s.workflowId !== workflowId) return;
    saving.current = true;
    const defn = toDefinition(s.nodes, s.edges);
    const sent = JSON.stringify(defn);
    s.markSaving();
    try {
      const res = await saveDraft(workflowId, defn, s.serverVersion);
      const now = useEditorStore.getState();
      now.markSaved(res.draft_version, res.issues);
      // 저장하는 사이 또 바뀌었으면 다시 저장 대상으로 둔다
      if (JSON.stringify(toDefinition(now.nodes, now.edges)) !== sent) useEditorStore.setState({ dirty: true });
      void qc.invalidateQueries({ queryKey: workflowKeys.all, refetchType: 'none' });
    } catch (e) {
      if (isApiError(e) && e.status === 409) {
        try {
          useEditorStore.getState().setConflict(await fetchWorkflow(workflowId));
        } catch {
          useEditorStore.getState().markSaveError('충돌을 확인하지 못했습니다.');
        }
      } else {
        const msg = isApiError(e) ? e.detail : (e as Error).message;
        useEditorStore.getState().markSaveError(msg);
        toast.error('저장하지 못했습니다. 자동으로 다시 시도합니다.', { id: 'autosave-error', description: msg });
        timer.current = setTimeout(() => void save(), RETRY_MS);
      }
    } finally {
      saving.current = false;
    }
  }, [enabled, workflowId, qc]);

  useEffect(() => {
    if (!enabled || !dirty || conflict) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(), AUTOSAVE_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [nodes, edges, dirty, conflict, enabled, save]);

  // 처음 열 때 한 번 검증해서 오류 노드를 표시
  useEffect(() => {
    if (!enabled) return;
    const s = useEditorStore.getState();
    if (s.workflowId !== workflowId) return;
    validateWorkflow(workflowId, toDefinition(s.nodes, s.edges))
      .then((r) => useEditorStore.getState().setIssues(r.issues))
      .catch(() => {});
  }, [workflowId, enabled]);

  const saveNow = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    useEditorStore.setState((s) => ({ dirty: s.dirty || s.saveStatus === 'error' }));
    void save();
  }, [save]);

  return { saveNow };
}
