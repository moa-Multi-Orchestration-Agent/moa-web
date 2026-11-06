'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { createWorkspaceSchema, useCreateWorkspace, useCurrentWorkspaceStore } from '@/entities/workspace';
import { isApiError } from '@/shared/lib/api-client';
import { copy } from '@/shared/lib/copy';
import { Button } from '@/shared/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';

/** 새 팀(워크스페이스) 만들기. 만들면 바로 그 팀으로 바꾸고 팀 설정으로 보낸다. */
export function CreateTeamDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const create = useCreateWorkspace();
  const setId = useCurrentWorkspaceStore((s) => s.setId);
  const router = useRouter();
  const [name, setName] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const submit = () => {
    const r = createWorkspaceSchema.safeParse({ name });
    if (!r.success) return setErr(r.error.issues[0]!.message);
    create.mutate(r.data, {
      onSuccess: (ws) => {
        toast.success(copy.team.created(ws.name));
        setId(ws.id);
        onOpenChange(false);
        setName('');
        router.push('/settings?tab=team');
      },
      onError: (e) => setErr(isApiError(e) ? e.detail : e.message),
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setErr(null); }}>
      <DialogContent>
        <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{copy.team.createTitle}</DialogTitle>
            <DialogDescription>{copy.team.createDesc}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="team-name">팀 이름</Label>
            <Input id="team-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 마케팅팀" maxLength={40} autoFocus aria-invalid={!!err} />
            {err ? <p role="alert" className="text-danger text-xs">{err}</p> : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>{copy.common.cancel}</Button>
            <Button type="submit" disabled={create.isPending}>{create.isPending ? <Loader2 className="animate-spin" aria-hidden /> : null}만들기</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
