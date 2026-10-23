'use client';

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { connectSse, type SseStatus } from '@/shared/lib/sse';
import { fetchRun, runKeys } from './api';
import { isTerminal, type RunDetailRow, type RunEvents, type RunStepRow } from './model';

export type RunEventHandlers = { [K in keyof RunEvents]?: (data: RunEvents[K]) => void } & {
  /** 폴링으로 전환됐을 때 받은 최신 상세(이벤트 대신) */
  onPoll?: (detail: RunDetailRow) => void;
};

/**
 * 실행 SSE 구독 (design.md 3.4.3 useRunEvents).
 * 이벤트를 실행 상세 Query 캐시에 반영하고, 호출 쪽 핸들러도 부른다.
 * 3회 실패하면 2초 폴링으로 바뀐다.
 */
export function useRunEvents(runId: string | null | undefined, handlers: RunEventHandlers = {}) {
  const qc = useQueryClient();
  const [connection, setConnection] = useState<SseStatus>('closed');
  const ref = useRef(handlers);
  ref.current = handlers;

  useEffect(() => {
    if (!runId) return;
    const key = runKeys.detail(runId);
    const patch = (fn: (r: RunDetailRow) => RunDetailRow) => qc.setQueryData<RunDetailRow>(key, (r) => (r ? fn(r) : r));
    const upsertStep = (step: Partial<RunStepRow> & { id: string }) =>
      patch((r) => {
        const exists = r.steps.some((s) => s.id === step.id);
        const steps = exists ? r.steps.map((s) => (s.id === step.id ? { ...s, ...step } : s)) : [...r.steps, step as RunStepRow];
        return { ...r, steps };
      });

    const conn = connectSse<RunEvents>(`/runs/${runId}/events`, {
      onStatus: setConnection,
      handlers: {
        'run.status': (d) => {
          patch((r) => ({ ...r, status: d.status, error_code: d.error_code ?? r.error_code }));
          ref.current['run.status']?.(d);
          if (isTerminal(d.status)) {
            conn.close();
            void qc.invalidateQueries({ queryKey: key });
            void qc.invalidateQueries({ queryKey: runKeys.all, refetchType: 'none' });
          }
          if (d.status === 'waiting_approval') void qc.invalidateQueries({ queryKey: runKeys.approvalsAll });
        },
        'step.started': (d) => {
          upsertStep({ id: d.step_id, run_id: runId, node_id: d.node_id, node_type: d.node_type ?? 'node', attempt: d.attempt, model: d.model ?? null, ok: null, started_at: new Date().toISOString(), finished_at: null, node_name: d.node_name, tokens_in: 0, tokens_out: 0, cost_usd: 0, latency_ms: null, input: null, output: null, error_code: null, kind: (d.kind as RunStepRow['kind']) ?? 'node' });
          ref.current['step.started']?.(d);
        },
        'step.delta': (d) => ref.current['step.delta']?.(d),
        'step.finished': (d) => {
          upsertStep({ id: d.step_id, ok: d.ok, latency_ms: d.latency_ms, tokens_in: d.tokens.in, tokens_out: d.tokens.out, cost_usd: d.cost, error_code: d.error_code ?? null, finished_at: new Date().toISOString(), output: d.output ?? null, ...(d.attempt ? { attempt: d.attempt } : {}), ...(d.model ? { model: d.model } : {}) });
          patch((r) => ({ ...r, tokens_in: r.tokens_in + d.tokens.in, tokens_out: r.tokens_out + d.tokens.out, cost_usd: Number((r.cost_usd + d.cost).toFixed(6)) }));
          ref.current['step.finished']?.(d);
        },
        'context.changed': (d) => {
          qc.setQueryData(['context', 'live', d.session_id], d);
          void qc.invalidateQueries({ queryKey: ['context'], predicate: (q) => q.queryKey.includes(d.session_id) && q.queryKey[1] !== 'live' });
          ref.current['context.changed']?.(d);
        },
        'approval.required': (d) => {
          void qc.invalidateQueries({ queryKey: runKeys.approvalsAll });
          void qc.invalidateQueries({ queryKey: key });
          ref.current['approval.required']?.(d);
        },
        heartbeat: (d) => ref.current.heartbeat?.(d),
      },
      poll: async () => {
        const detail = await fetchRun(runId);
        qc.setQueryData(key, detail);
        ref.current.onPoll?.(detail);
        return !isTerminal(detail.status);
      },
    });
    return () => conn.close();
  }, [runId, qc]);

  return { connection };
}
