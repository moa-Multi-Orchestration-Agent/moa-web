'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Play } from 'lucide-react';
import { toast } from 'sonner';
import { useStartRun, type RunDetail } from '@/entities/run';
import { isApiError } from '@/shared/lib/api-client';
import { copy } from '@/shared/lib/copy';
import { Button } from '@/shared/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { Label } from '@/shared/ui/label';
import { Textarea } from '@/shared/ui/textarea';

export function RerunDialog({ run, open, onOpenChange }: { run: RunDetail; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const start = useStartRun();
  const router = useRouter();
  useEffect(() => {
    if (open) {
      setText(JSON.stringify(run.input ?? {}, null, 2));
      setError(null);
    }
  }, [open, run.input]);
  const submit = () => {
    let input: Record<string, unknown>;
    try {
      input = JSON.parse(text);
    } catch {
      setError('JSON 형식이 아닙니다.');
      return;
    }
    const chat = run.targetKind === 'agent' && !run.workflowId;
    start.mutate(
      { ...(chat ? { agent_id: run.agentId ?? undefined } : { workflow_id: run.workflowId ?? undefined, agent_id: run.agentId ?? undefined }), input, trigger: 'editor', rerun_of: run.id },
      {
        onSuccess: (r) => {
          toast.success(copy.runs.rerunDone);
          onOpenChange(false);
          router.push(`/runs/${r.id}`);
        },
        onError: (e) => setError(isApiError(e) ? e.detail : e.message),
      },
    );
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{copy.runs.rerunTitle}</DialogTitle>
          <DialogDescription>{copy.runs.rerunBody}</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="rerun-input">{copy.runs.input} (JSON)</Label>
          <Textarea id="rerun-input" value={text} onChange={(e) => setText(e.target.value)} className="h-48 font-mono text-xs" aria-invalid={!!error} aria-describedby={error ? 'rerun-error' : undefined} />
          {error ? (
            <p id="rerun-error" role="alert" className="text-danger text-sm">
              {error}
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {copy.common.cancel}
          </Button>
          <Button onClick={submit} disabled={start.isPending} data-testid="rerun-submit">
            {start.isPending ? <Loader2 className="animate-spin" aria-hidden /> : <Play aria-hidden />}
            {copy.runs.rerun}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
