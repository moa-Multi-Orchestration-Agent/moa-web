'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Bot, ChevronDown, Loader2, RefreshCw, Send, WifiOff } from 'lucide-react';
import { toast } from 'sonner';
import { useDecideApproval } from '@/entities/run';
import { useCurrentWorkspace } from '@/entities/workspace';
import { copy } from '@/shared/lib/copy';
import { cn } from '@/shared/lib/utils';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/shared/ui/collapsible';
import { Guarded } from '@/shared/ui/guarded';
import { Textarea } from '@/shared/ui/textarea';
import type { ChatMessage, ChatStep } from './use-agent-chat';

function StepRow({ s }: { s: ChatStep }) {
  const label = s.kind === 'workflow' ? '워크플로' : s.kind === 'approval' ? '승인' : '스킬';
  const status = s.status === 'ok' ? { t: copy.chat.done, v: 'green' as const } : s.status === 'error' ? { t: copy.chat.failed, v: 'red' as const } : s.status === 'waiting' ? { t: copy.chat.waiting, v: 'orange' as const } : { t: copy.chat.running, v: 'blue' as const };
  const preview = (s.output as { preview?: string } | undefined)?.preview;
  return (
    <Collapsible className="bg-surface rounded-md">
      <CollapsibleTrigger className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm" aria-label={`${s.name} 도구 호출 자세히`}>
        <Badge variant={s.kind === 'workflow' ? 'dark' : 'gray'}>{label}</Badge>
        <span className="min-w-0 flex-1 truncate">{s.name}</span>
        <Badge variant={status.v}>
          {s.status === 'running' ? <Loader2 className="animate-spin" aria-hidden /> : null}
          {status.t}
        </Badge>
        <ChevronDown className="text-muted size-4" aria-hidden />
      </CollapsibleTrigger>
      <CollapsibleContent className="px-3 pb-3">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt={`${s.name} 3D 결과 미리보기`} className="bg-background mb-2 h-32 rounded border object-contain" />
        ) : null}
        <pre className="bg-background max-h-40 overflow-auto rounded border p-2 font-mono text-[11px]">{s.errorCode ? `오류: ${s.errorCode}` : JSON.stringify(s.output ?? null, null, 2)}</pre>
      </CollapsibleContent>
    </Collapsible>
  );
}

function ApprovalCard({ m }: { m: ChatMessage }) {
  const decide = useDecideApproval();
  const { can } = useCurrentWorkspace();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(m.approval?.preview ?? '');
  if (!m.approval) return null;
  const act = (approve: boolean, comment?: string) =>
    decide.mutate({ id: m.approval!.id, approve, comment, runId: m.runId }, { onSuccess: () => toast.success(approve ? copy.toast.approved : copy.toast.rejected), onError: (e) => toast.error(e.message) });
  return (
    <div className="border-warning/30 bg-warning-soft/60 rounded-md border p-3" role="group" aria-label="승인 요청">
      <p className="text-warning text-sm font-semibold">{m.approval.title}</p>
      <p className="mt-1 text-sm">{copy.chat.approvalNeeded}</p>
      {editing ? (
        <Textarea value={text} onChange={(e) => setText(e.target.value)} className="bg-background mt-2 text-sm" aria-label="보낼 내용 수정" />
      ) : m.approval.preview ? (
        <p className="bg-background mt-2 line-clamp-3 rounded border border-dashed p-2 text-xs">{m.approval.preview}</p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <Guarded allowed={can('approve')} reason={copy.common.adminOnly}>
          <Button size="sm" onClick={() => act(true, editing ? `수정 후 승인: ${text}` : undefined)} disabled={decide.isPending}>
            {editing ? copy.chat.editApprove : copy.chat.approveSend}
          </Button>
        </Guarded>
        {!editing ? (
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            수정
          </Button>
        ) : null}
        <Guarded allowed={can('approve')} reason={copy.common.adminOnly}>
          <Button size="sm" variant="ghost" onClick={() => act(false)} disabled={decide.isPending}>
            {copy.chat.reject}
          </Button>
        </Guarded>
      </div>
    </div>
  );
}

export function MessageView({ m, onRetry }: { m: ChatMessage; onRetry?: () => void }) {
  if (m.role === 'user') {
    return <div className="bg-primary-soft ml-auto max-w-[85%] rounded-lg px-4 py-2.5 text-sm whitespace-pre-wrap">{m.text}</div>;
  }
  const streaming = m.status === 'running' || m.status === 'queued';
  return (
    <div className="bg-card max-w-[95%] space-y-2.5 rounded-lg border p-3.5" aria-live="polite" aria-busy={streaming}>
      {m.steps.length ? <p className="text-muted text-xs">{copy.chat.toolsUsed}</p> : null}
      {m.steps.map((s) => (
        <StepRow key={s.id} s={s} />
      ))}
      <ApprovalCard m={m} />
      {m.text ? (
        <p className="text-sm leading-6 whitespace-pre-wrap">
          {m.text}
          {streaming ? <span className="bg-foreground ml-0.5 inline-block h-4 w-1.5 animate-pulse align-middle" aria-hidden /> : null}
        </p>
      ) : streaming && !m.steps.length ? (
        <p className="text-muted flex items-center gap-2 text-sm">
          <Loader2 className="size-4 animate-spin" aria-hidden /> 생각하는 중…
        </p>
      ) : null}
      {m.status === 'failed' ? (
        <div role="alert" className="text-danger flex flex-wrap items-center gap-2 text-sm">
          <AlertTriangle className="size-4" aria-hidden /> {copy.chat.errorPrefix}
          {m.errorCode ? <code className="font-mono text-xs">{m.errorCode}</code> : null}
          {onRetry ? (
            <Button size="xs" variant="outline" onClick={onRetry}>
              <RefreshCw aria-hidden /> {copy.chat.retry}
            </Button>
          ) : null}
        </div>
      ) : null}
      {m.runId && !streaming ? (
        <Link href={`/runs/${m.runId}`} className="text-muted inline-block text-xs hover:underline">
          {copy.chat.viewRun} →
        </Link>
      ) : null}
    </div>
  );
}

export function ChatPanel({
  messages,
  onSend,
  busy,
  connection,
  disabled,
  disabledReason,
  className,
}: {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  busy: boolean;
  connection: string;
  disabled?: boolean;
  disabledReason?: string;
  className?: string;
}) {
  const [text, setText] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages]);
  const submit = () => {
    if (!text.trim() || busy || disabled) return;
    onSend(text);
    setText('');
  };
  const lastUser = [...messages].reverse().find((m) => m.role === 'user');

  return (
    <div className={cn('flex min-h-0 flex-col', className)}>
      {connection === 'reconnecting' || connection === 'polling' ? (
        <p role="status" className="bg-warning-soft text-warning flex items-center gap-2 px-4 py-2 text-xs">
          <WifiOff className="size-4" aria-hidden /> {connection === 'polling' ? copy.chat.polling : copy.chat.reconnecting}
        </p>
      ) : null}
      <div className="bg-surface min-h-0 flex-1 space-y-3 overflow-y-auto p-4" role="log" aria-label="테스트 대화">
        {messages.length === 0 ? (
          <div className="text-muted flex h-full flex-col items-center justify-center gap-2 text-center text-sm">
            <Bot className="size-8" aria-hidden />
            <p className="max-w-xs">{copy.chat.empty}</p>
          </div>
        ) : (
          messages.map((m) => <MessageView key={m.id} m={m} onRetry={m.status === 'failed' && lastUser ? () => onSend(lastUser.text) : undefined} />)
        )}
        <div ref={endRef} />
      </div>
      <form
        className="bg-background flex items-end gap-2 border-t p-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
          rows={1}
          placeholder={disabled ? disabledReason : copy.chat.placeholder}
          aria-label="테스트 메시지 입력"
          className="max-h-32 min-h-10 resize-none"
          disabled={disabled}
        />
        <Button type="submit" disabled={busy || !text.trim() || disabled}>
          {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
          {copy.chat.send}
        </Button>
      </form>
    </div>
  );
}
