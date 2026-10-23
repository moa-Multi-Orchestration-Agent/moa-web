'use client';

import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { isTerminal, useRunEvents, useStartRun, type RunStatus } from '@/entities/run';

export interface ChatStep {
  id: string;
  nodeId: string;
  name: string;
  kind: string;
  status: 'running' | 'ok' | 'error' | 'waiting';
  output?: unknown;
  errorCode?: string | null;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  runId?: string;
  status?: RunStatus;
  steps: ChatStep[];
  approval?: { id: string; title: string; message: string; preview?: string } | null;
  errorCode?: string | null;
}

const HIDDEN_NODES = new Set(['in', 'plan', 'answer']);

/** 에이전트 테스트 대화: POST /runs → SSE로 답변 스트리밍 */
export function useAgentChat(agentId: string | null, sessionId: string | null, onSession: (id: string) => void) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeRun, setActiveRun] = useState<string | null>(null);
  const start = useStartRun();

  const patchRun = useCallback((runId: string, fn: (m: ChatMessage) => ChatMessage) => setMessages((all) => all.map((m) => (m.runId === runId ? fn(m) : m))), []);

  const { connection } = useRunEvents(activeRun, {
    'step.started': (d) => {
      if (!activeRun || HIDDEN_NODES.has(d.node_id)) return;
      patchRun(activeRun, (m) =>
        m.steps.some((s) => s.id === d.step_id)
          ? m
          : { ...m, steps: [...m.steps, { id: d.step_id, nodeId: d.node_id, name: d.node_name ?? d.node_id, kind: d.kind ?? (d.node_type === 'approval' ? 'approval' : 'skill'), status: d.node_type === 'approval' ? 'waiting' : 'running' }] },
      );
    },
    'step.delta': (d) => {
      if (!activeRun || d.node_id !== 'answer') return;
      patchRun(activeRun, (m) => ({ ...m, text: m.text + d.text }));
    },
    'step.finished': (d) => {
      if (!activeRun) return;
      patchRun(activeRun, (m) => ({ ...m, steps: m.steps.map((s) => (s.id === d.step_id ? { ...s, status: d.ok ? 'ok' : 'error', output: d.output, errorCode: d.error_code } : s)) }));
    },
    'approval.required': (d) => {
      if (!activeRun) return;
      patchRun(activeRun, (m) => ({ ...m, status: 'waiting_approval', approval: { id: d.approval_id, title: d.summary.title, message: d.summary.message, preview: d.summary.preview } }));
    },
    'run.status': (d) => {
      patchRun(d.run_id, (m) => ({ ...m, status: d.status, errorCode: d.error_code ?? m.errorCode, approval: d.status === 'running' ? null : m.approval }));
      if (isTerminal(d.status)) setActiveRun(null);
    },
    onPoll: (detail) => {
      patchRun(detail.id, (m) => ({
        ...m,
        status: detail.status,
        text: m.text || (detail.output as { text?: string } | null)?.text || '',
        errorCode: detail.error_code,
        steps: detail.steps.filter((s) => !HIDDEN_NODES.has(s.node_id)).map((s) => ({ id: s.id, nodeId: s.node_id, name: s.node_name ?? s.node_id, kind: s.kind ?? 'skill', status: s.ok === null ? 'running' : s.ok ? 'ok' : 'error', output: s.output, errorCode: s.error_code })),
      }));
      if (isTerminal(detail.status)) setActiveRun(null);
    },
  });

  const send = useCallback(
    async (text: string) => {
      if (!agentId || !text.trim()) return;
      const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', text: text.trim(), steps: [] };
      setMessages((all) => [...all, userMsg]);
      try {
        const run = await start.mutateAsync({ agent_id: agentId, input: { message: text.trim() }, context_session_id: sessionId ?? undefined });
        if (run.context_session_id && run.context_session_id !== sessionId) onSession(run.context_session_id);
        setMessages((all) => [...all, { id: crypto.randomUUID(), role: 'assistant', text: '', runId: run.id, status: 'queued', steps: [] }]);
        setActiveRun(run.id);
      } catch (e) {
        setMessages((all) => [...all, { id: crypto.randomUUID(), role: 'assistant', text: '', status: 'failed', steps: [], errorCode: (e as { code?: string }).code ?? 'NETWORK' }]);
        toast.error((e as Error).message);
      }
    },
    [agentId, sessionId, onSession, start],
  );

  const reset = useCallback(() => {
    setMessages([]);
    setActiveRun(null);
  }, []);

  return { messages, send, reset, busy: !!activeRun || start.isPending, connection, activeRun };
}
