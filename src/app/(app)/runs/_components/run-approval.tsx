'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useDecideApproval, type ApprovalRow } from '@/entities/run';
import { useCurrentWorkspace } from '@/entities/workspace';
import { copy } from '@/shared/lib/copy';
import { Button } from '@/shared/ui/button';
import { Guarded } from '@/shared/ui/guarded';
import { Textarea } from '@/shared/ui/textarea';

/** Figma 10 승인 박스: 승인하고 계속 · 수정 후 승인 · 거절 */
export function RunApproval({ approval, runId }: { approval: ApprovalRow; runId: string }) {
  const decide = useDecideApproval();
  const { can } = useCurrentWorkspace();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(approval.summary.preview ?? '');
  const act = (approve: boolean, comment?: string) =>
    decide.mutate({ id: approval.id, approve, comment, runId }, { onSuccess: () => toast.success(approve ? copy.toast.approved : copy.toast.rejected), onError: (e) => toast.error(e.message) });
  return (
    <section className="bg-warning-soft border-warning/30 rounded-lg border p-4" aria-label="승인 요청" data-testid="run-approval">
      <h3 className="text-warning font-bold">{copy.runs.approvalTitle(approval.summary.title)}</h3>
      <p className="mt-1 text-sm">{approval.summary.message}</p>
      {editing ? (
        <Textarea value={text} onChange={(e) => setText(e.target.value)} className="bg-background mt-3 text-sm" aria-label="보낼 내용 수정" />
      ) : (
        <p className="bg-background/70 text-muted mt-3 rounded-md border border-dashed p-3 text-sm">{approval.summary.preview || '보낼 메시지 미리보기'}</p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Guarded allowed={can('approve')} reason={copy.common.adminOnly}>
          <Button onClick={() => act(true, editing ? `수정 후 승인: ${text}` : undefined)} disabled={decide.isPending} data-testid="approve-run">
            {editing ? copy.runs.editApprove : copy.runs.approve}
          </Button>
        </Guarded>
        {!editing ? (
          <Button variant="outline" onClick={() => setEditing(true)}>
            {copy.runs.editApprove}
          </Button>
        ) : null}
        <Guarded allowed={can('approve')} reason={copy.common.adminOnly}>
          <Button variant="ghost" onClick={() => act(false)} disabled={decide.isPending}>
            {copy.runs.reject}
          </Button>
        </Guarded>
      </div>
    </section>
  );
}
