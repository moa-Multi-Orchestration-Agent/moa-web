'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Loader2, MessageSquare, Play, RotateCcw, Send } from 'lucide-react';
import { toast } from 'sonner';
import { fetchRun, isTerminal, useRunEvents, useStartRun, type RunStatus } from '@/entities/run';
import type { InputField, Workflow } from '@/entities/workflow';
import { isApiError } from '@/shared/lib/api-client';
import { Button } from '@/shared/ui/button';
import type { FileRef } from '@/shared/lib/attachments';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { Textarea } from '@/shared/ui/textarea';
import { ExtraFields, fileInputs, refsFromInput } from './extra-fields';
import { buildInput, chatField, outputText } from './output-text';

interface Msg {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  runId?: string;
  status?: RunStatus;
  step?: string;
  error?: string | null;
}

/**
 * 워크플로 목록의 실행 버튼.
 * - 수동 입력 + 출력 노드가 있으면(run_mode=chat) 대화창을 열어 적은 내용으로 실행하고 답을 보여 준다.
 * - 그 밖에는 바로 실행하고 실행 상세(로그) 화면으로 간다.
 */
export function WorkflowRunButton({ workflow, disabled, size = 'xs', full }: { workflow: Workflow; disabled?: boolean; size?: 'xs' | 'sm' | 'default'; full?: boolean }) {
  const router = useRouter();
  const start = useStartRun();
  const [open, setOpen] = useState(false);
  const chat = workflow.runMode === 'chat';

  const runNow = () =>
    start.mutate(
      { workflow_id: workflow.id, input: defaultsOf(workflow) },
      {
        onSuccess: (r) => {
          toast.success(`${workflow.name} 실행을 시작했습니다.`);
          router.push(`/runs/${r.id}`);
        },
        onError: (e) => toast.error(isApiError(e) ? e.detail : e.message),
      },
    );

  return (
    <>
      <Button
        variant="outline"
        size={size}
        className={full ? 'w-full' : undefined}
        disabled={disabled || start.isPending}
        onClick={() => (chat ? setOpen(true) : runNow())}
        aria-label={`${workflow.name} 실행`}
        title={chat ? '입력하고 답 받기' : '실행하고 로그 보기'}
      >
        {start.isPending ? <Loader2 className="animate-spin" aria-hidden /> : chat ? <MessageSquare aria-hidden /> : <Play aria-hidden />} 실행
      </Button>
      {chat ? <WorkflowChatDialog workflow={workflow} open={open} onOpenChange={setOpen} /> : null}
    </>
  );
}

/** 로그 모드 실행 입력: 입력 노드 칸의 기본값만 채운다 */
function defaultsOf(w: Workflow): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of (w.inputFields ?? []) as InputField[]) if (f.default !== undefined) out[f.name] = f.default;
  return out;
}

function WorkflowChatDialog({ workflow, open, onOpenChange }: { workflow: Workflow; open: boolean; onOpenChange: (o: boolean) => void }) {
  const fields = (workflow.inputFields ?? []) as InputField[];
  const main = chatField(fields);
  const others = fields.filter((f) => f.name !== main);
  const start = useStartRun();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [extra, setExtra] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<Record<string, File[]>>({});
  const [reused, setReused] = useState<Record<string, FileRef[]>>({});
  const [activeRun, setActiveRun] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const patch = useCallback((runId: string, fn: (m: Msg) => Msg) => setMessages((all) => all.map((m) => (m.runId === runId ? fn(m) : m))), []);

  // 끝나면 실행 결과(output)에서 답을 꺼내 스트리밍 중이던 글을 바꾼다
  const finish = useCallback(
    async (runId: string) => {
      setActiveRun(null);
      try {
        const d = await fetchRun(runId);
        const answer = outputText(d.output);
        patch(runId, (m) => ({ ...m, status: d.status, step: undefined, error: d.error_code, text: answer || m.text }));
      } catch (e) {
        patch(runId, (m) => ({ ...m, status: 'failed', step: undefined, error: (e as Error).message }));
      }
    },
    [patch],
  );

  useRunEvents(activeRun, {
    'step.started': (d) => activeRun && patch(activeRun, (m) => ({ ...m, step: d.node_name ?? d.node_id })),
    'step.delta': (d) => activeRun && patch(activeRun, (m) => ({ ...m, text: m.text + d.text })),
    'run.status': (d) => {
      patch(d.run_id, (m) => ({ ...m, status: d.status }));
      if (isTerminal(d.status)) void finish(d.run_id);
    },
    onPoll: (detail) => {
      patch(detail.id, (m) => ({ ...m, status: detail.status }));
      if (isTerminal(detail.status)) void finish(detail.id);
    },
  });

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [messages]);

  const send = async () => {
    const q = text.trim();
    if (!q || activeRun) return;
    let attached: Record<string, unknown>;
    try {
      attached = await fileInputs(fields, files, reused);
    } catch (e) {
      toast.error((e as Error).message);
      return;
    }
    setText('');
    setMessages((all) => [...all, { id: crypto.randomUUID(), role: 'user', text: q }]);
    try {
      const run = await start.mutateAsync({ workflow_id: workflow.id, input: { ...buildInput(fields, extra, q), ...attached }, context_session_id: sessionId ?? undefined });
      if (run.context_session_id) setSessionId(run.context_session_id); // 같은 대화 기록을 이어서 쓴다
      const refs = refsFromInput(fields, run.input); // 서버가 저장한 첨부는 다음 메시지에서 참조로 다시 쓴다
      if (Object.keys(refs).length) {
        setReused((r) => ({ ...r, ...refs }));
        setFiles((f) => Object.fromEntries(Object.entries(f).filter(([k]) => !refs[k])));
      }
      setMessages((all) => [...all, { id: crypto.randomUUID(), role: 'assistant', text: '', runId: run.id, status: 'queued' }]);
      setActiveRun(run.id);
    } catch (e) {
      setMessages((all) => [...all, { id: crypto.randomUUID(), role: 'assistant', text: '', status: 'failed', error: isApiError(e) ? e.detail : (e as Error).message }]);
    }
  };

  const reset = () => {
    setMessages([]);
    setSessionId(null);
    setFiles({});
    setReused({});
    setActiveRun(null);
  };
  const busy = !!activeRun || start.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(720px,90vh)] max-w-2xl flex-col gap-0 p-0">
        <DialogHeader className="border-b px-5 py-4">
          <DialogTitle className="flex items-center gap-2">
            {workflow.name}
            <Button variant="ghost" size="xs" className="ml-auto" onClick={reset} disabled={busy || !messages.length}>
              <RotateCcw aria-hidden /> 새 대화
            </Button>
          </DialogTitle>
          <DialogDescription>적은 내용을 입력 노드의 &apos;{main}&apos; 칸에 넣어 실행하고, 출력 노드의 결과를 보여 줍니다.</DialogDescription>
        </DialogHeader>
        <ExtraFields
          fields={others}
          extra={extra}
          onExtra={(name, v) => setExtra((x) => ({ ...x, [name]: v }))}
          files={files}
          onFiles={(name, v) => setFiles((x) => ({ ...x, [name]: v }))}
          reused={reused}
          disabled={busy}
        />
        <div ref={logRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-5" role="log" aria-label="실행 대화">
          {messages.length === 0 ? (
            <div className="text-muted flex h-full flex-col items-center justify-center gap-2 text-center text-sm">
              <MessageSquare className="size-8" aria-hidden />
              <p>아래에 입력하면 이 워크플로를 실행해 답을 보여 줘요.</p>
            </div>
          ) : (
            messages.map((m) => (m.role === 'user' ? <UserBubble key={m.id} text={m.text} /> : <AnswerBubble key={m.id} m={m} />))
          )}
        </div>
        <form
          className="flex items-end gap-2 border-t p-3"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void send();
              }
            }}
            placeholder="입력하고 Enter (줄바꿈은 Shift+Enter)"
            className="max-h-32 min-h-10 resize-none"
            aria-label="워크플로 입력"
          />
          <Button type="submit" size="icon" disabled={busy || !text.trim()} aria-label="보내기">
            {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function UserBubble({ text }: { text: string }) {
  return <div className="bg-primary-soft ml-auto max-w-[85%] rounded-lg px-4 py-2.5 text-sm whitespace-pre-wrap">{text}</div>;
}

function AnswerBubble({ m }: { m: Msg }) {
  const running = !!m.status && !isTerminal(m.status) && m.status !== 'waiting_approval';
  const failed = m.status === 'failed' || m.status === 'canceled' || (!!m.error && !m.text);
  return (
    <div className="bg-card max-w-[95%] space-y-2 rounded-lg border p-3.5" aria-live="polite" aria-busy={running}>
      {m.text ? <p className="text-sm leading-6 whitespace-pre-wrap">{m.text}</p> : null}
      {running && !m.text ? (
        <p className="text-muted flex items-center gap-2 text-sm">
          <Loader2 className="size-4 animate-spin" aria-hidden /> {m.step ? `${m.step} 실행 중…` : '실행 준비 중…'}
        </p>
      ) : null}
      {m.status === 'waiting_approval' ? <p className="text-warning text-sm">승인 대기 중이에요. 로그 화면에서 승인하면 계속 진행됩니다.</p> : null}
      {failed ? (
        <p role="alert" className="text-danger flex items-center gap-2 text-sm">
          <AlertTriangle className="size-4" aria-hidden /> 실행에 실패했어요{m.error ? ` (${m.error})` : ''}
        </p>
      ) : null}
      {m.runId ? (
        <Link href={`/runs/${m.runId}`} className="text-muted inline-block text-xs hover:underline">
          로그 보기 →
        </Link>
      ) : null}
    </div>
  );
}
