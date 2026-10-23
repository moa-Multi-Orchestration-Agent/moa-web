'use client';

import { useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useConnectSlack, useSlackLink } from '@/entities/endpoint';
import { useCurrentWorkspace } from '@/entities/workspace';
import { copy } from '@/shared/lib/copy';
import { relativeTime } from '@/shared/lib/format';
import { Button } from '@/shared/ui/button';
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { Guarded } from '@/shared/ui/guarded';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Skeleton } from '@/shared/ui/skeleton';

/** 엔드포인트를 Slack 채널에 붙이는 목 흐름. 실제로는 Slack 앱 설치(OAuth) 후 이벤트 구독을 건다. */
export function SlackConnect({ endpointId, agentName }: { endpointId: string; agentName: string }) {
  const { can } = useCurrentWorkspace();
  const link = useSlackLink(endpointId);
  const connect = useConnectSlack(endpointId);
  const [open, setOpen] = useState(false);
  const [off, setOff] = useState(false);
  const [team, setTeam] = useState('');
  const [channel, setChannel] = useState('#');
  const [err, setErr] = useState<string | null>(null);

  if (link.isPending) return <Skeleton className="h-8 w-32" />;
  if (link.isError) return <Button size="sm" variant="outline" onClick={() => void link.refetch()}>다시 불러오기</Button>;

  const submit = () => {
    if (!team.trim()) return setErr('Slack 워크스페이스 이름을 입력하세요.');
    if (!/^#[\w가-힣-]+$/.test(channel)) return setErr('채널은 #으로 시작하고 공백 없이 입력하세요.');
    setErr(null);
    connect.mutate({ team: team.trim(), channel }, {
      onSuccess: () => { toast.success(`${channel} 채널에 연결했습니다.`); setOpen(false); },
      onError: (e) => setErr(e.message),
    });
  };

  const l = link.data;
  return (
    <>
      {l ? (
        <div className="space-y-2" data-testid="slack-linked">
          <p className="flex items-center gap-1.5 text-sm"><CheckCircle2 className="text-success size-4" aria-hidden /> 연결됨 · <span className="font-mono text-xs">{l.team} {l.channel}</span></p>
          <p className="text-muted text-xs">{relativeTime(l.connected_at)} 연결</p>
          <Guarded allowed={can('manageKeys')} reason={copy.common.adminOnly}>
            <Button size="sm" variant="ghost" onClick={() => setOff(true)}>연결 해제</Button>
          </Guarded>
        </div>
      ) : (
        <Guarded allowed={can('manageKeys')} reason={copy.common.adminOnly}>
          <Button size="sm" variant="outline" onClick={() => { setOpen(true); setErr(null); }} data-testid="slack-connect">Slack에 연결</Button>
        </Guarded>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Slack에 연결</DialogTitle>
            <DialogDescription>채널에서 @MOA를 멘션하면 {agentName}이(가) 답합니다. 모의 연결이라 실제 Slack 앱은 설치되지 않습니다.</DialogDescription>
          </DialogHeader>
          <form id="slack-form" onSubmit={(e) => { e.preventDefault(); submit(); }} className="space-y-3">
            <div className="space-y-1.5"><Label htmlFor="slack-team">Slack 워크스페이스</Label><Input id="slack-team" value={team} onChange={(e) => setTeam(e.target.value)} placeholder="예: moa-team" /></div>
            <div className="space-y-1.5"><Label htmlFor="slack-channel">채널</Label><Input id="slack-channel" value={channel} onChange={(e) => setChannel(e.target.value)} placeholder="#cs-bot" className="font-mono" /></div>
            {err ? <p className="text-danger text-xs" role="alert">{err}</p> : null}
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{copy.common.cancel}</Button>
            <Button type="submit" form="slack-form" disabled={connect.isPending}>{connect.isPending ? <Loader2 className="animate-spin" aria-hidden /> : null}연결</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={off}
        onOpenChange={setOff}
        title="Slack 연결을 해제할까요?"
        description="채널에서 @MOA 멘션에 더 이상 답하지 않습니다."
        confirmLabel="해제"
        pending={connect.isPending}
        onConfirm={() => connect.mutate(null, { onSuccess: () => { toast.success('Slack 연결을 해제했습니다.'); setOff(false); }, onError: (e) => toast.error(e.message) })}
      />
    </>
  );
}
