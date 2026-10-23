'use client';

import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';
import { isTerminal, useCancelRun, useRunEvents, useStartRun, type RunStatus } from '@/entities/run';
import { isApiError } from '@/shared/lib/api-client';
import { toDefinition } from './convert';
import { MAX_CONSOLE_LINES, useEditorStore } from './store';

export interface ConsoleLine {
  id: string;
  ts: number;
  kind: 'status' | 'start' | 'text' | 'ok' | 'error' | 'approval' | 'context';
  nodeId?: string;
  text: string;
}

/** 편집기 테스트 실행: POST /runs → SSE → 캔버스 노드 상태·콘솔 로그 */
export function useEditorRun(workflowId: string) {
  const [runId, setRunId] = useState<string | null>(null);
  const [status, setStatus] = useState<RunStatus | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [approval, setApproval] = useState<{ id: string; nodeId: string; title: string; message: string } | null>(null);
  const [lines, setLines] = useState<ConsoleLine[]>([]);
  const [dropped, setDropped] = useState(0);
  const start = useStartRun();
  const cancel = useCancelRun();
  const stepNode = useRef(new Map<string, string>());
  const nodeName = (id: string) => useEditorStore.getState().nodes.find((n) => n.id === id)?.data.name ?? id;

  const push = useCallback((l: Omit<ConsoleLine, 'id' | 'ts'>, mergeText = false) => {
    setLines((all) => {
      if (mergeText) {
        const last = all.at(-1);
        if (last && last.kind === 'text' && last.nodeId === l.nodeId) return [...all.slice(0, -1), { ...last, text: last.text + l.text }];
      }
      const next = [...all, { ...l, id: `${Date.now()}-${all.length}`, ts: Date.now() }];
      if (next.length > MAX_CONSOLE_LINES) {
        setDropped((d) => d + (next.length - MAX_CONSOLE_LINES));
        return next.slice(-MAX_CONSOLE_LINES);
      }
      return next;
    });
  }, []);

  const { connection } = useRunEvents(runId, {
    'run.status': (d) => {
      setStatus(d.status);
      push({ kind: 'status', text: `실행 상태: ${d.status}${d.error_code ? ` (${d.error_code})` : ''}` });
      if (d.status !== 'waiting_approval') setApproval(null);
      if (isTerminal(d.status)) {
        if (d.status === 'succeeded') toast.success('테스트 실행이 끝났습니다.');
        else if (d.status === 'failed') toast.error(`실행이 실패했습니다${d.error_code ? ` · ${d.error_code}` : ''}`);
      }
    },
    'step.started': (d) => {
      stepNode.current.set(d.step_id, d.node_id);
      useEditorStore.getState().setRunState(d.node_id, d.node_type === 'approval' ? 'waiting' : 'running');
      push({ kind: 'start', nodeId: d.node_id, text: `▶ ${nodeName(d.node_id)} 시작${d.attempt > 1 ? ` (시도 ${d.attempt}, ${d.model})` : ''}` });
    },
    'step.delta': (d) => push({ kind: 'text', nodeId: d.node_id ?? stepNode.current.get(d.step_id), text: d.text }, true),
    'step.finished': (d) => {
      const nodeId = d.node_id ?? stepNode.current.get(d.step_id) ?? '';
      useEditorStore.getState().setRunState(nodeId, d.ok ? 'ok' : 'error');
      push({ kind: d.ok ? 'ok' : 'error', nodeId, text: d.ok ? `✓ ${nodeName(nodeId)} 완료 · ${d.latency_ms}ms · 토큰 ${d.tokens.in + d.tokens.out} · $${d.cost.toFixed(4)}` : `✗ ${nodeName(nodeId)} 실패 · ${d.error_code ?? ''}` });
    },
    'context.changed': (d) => {
      setSessionId(d.session_id);
      push({ kind: 'context', text: `컨텍스트 ${d.used_tokens}/${d.budget} 토큰${d.compressed ? ' · 압축됨' : ''}` });
    },
    'approval.required': (d) => {
      useEditorStore.getState().setRunState(d.node_id, 'waiting');
      setApproval({ id: d.approval_id, nodeId: d.node_id, title: d.summary.title, message: d.summary.message });
      push({ kind: 'approval', nodeId: d.node_id, text: `✋ ${d.summary.title} — 승인이 필요합니다` });
    },
    onPoll: (detail) => {
      setStatus(detail.status);
      for (const s of detail.steps) useEditorStore.getState().setRunState(s.node_id, s.ok === null ? (s.node_type === 'approval' ? 'waiting' : 'running') : s.ok ? 'ok' : 'error');
    },
  });

  const run = useCallback(
    async (input: Record<string, unknown>) => {
      const s = useEditorStore.getState();
      s.resetRunState();
      setLines([]);
      setDropped(0);
      setApproval(null);
      setStatus('queued');
      try {
        const r = await start.mutateAsync({ workflow_id: workflowId, input, trigger: 'editor', definition: toDefinition(s.nodes, s.edges) });
        setRunId(r.id);
        useEditorStore.getState().setLastRunId(r.id);
        setSessionId(r.context_session_id);
        push({ kind: 'status', text: `실행 시작 · ${r.id}` });
      } catch (e) {
        setStatus(null);
        toast.error(isApiError(e) ? e.detail : (e as Error).message);
      }
    },
    [start, workflowId, push],
  );

  const stop = useCallback(() => {
    if (!runId) return;
    cancel.mutate(runId, { onSuccess: () => toast.success('실행을 취소했습니다.'), onError: (e) => toast.error(e.message) });
  }, [cancel, runId]);

  return { run, stop, runId, status, sessionId, approval, lines, dropped, connection, busy: start.isPending || (!!status && !isTerminal(status) && status !== 'waiting_approval') };
}
