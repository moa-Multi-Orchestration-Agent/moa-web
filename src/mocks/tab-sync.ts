/**
 * 탭 사이 목 DB 동기화(메모리만, BroadcastChannel). 같은 워크플로를 두 탭에서 고칠 때
 * 실제 서버처럼 한쪽 저장이 다른 쪽의 draft_version을 올리도록 한다(충돌 다이얼로그 재현용).
 */
import type { WorkflowDefinition } from '@/entities/workflow/model';
import { db } from './db';

type Msg = { type: 'draft'; id: string; draft: WorkflowDefinition; draft_version: number; updated_at: string };

let channel: BroadcastChannel | null = null;

export function startTabSync() {
  if (channel || typeof BroadcastChannel === 'undefined') return;
  channel = new BroadcastChannel('moa-mock-db');
  channel.onmessage = (e: MessageEvent<Msg>) => {
    const m = e.data;
    if (m?.type !== 'draft') return;
    const w = db.workflows.find((x) => x.id === m.id);
    if (w && m.draft_version > w.draft_version) Object.assign(w, { draft: m.draft, draft_version: m.draft_version, updated_at: m.updated_at });
  };
}

export function broadcastDraft(id: string) {
  const w = db.workflows.find((x) => x.id === id);
  if (!channel || !w) return;
  channel.postMessage({ type: 'draft', id, draft: structuredClone(w.draft), draft_version: w.draft_version, updated_at: w.updated_at } satisfies Msg);
}
