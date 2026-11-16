'use client';

import Link from 'next/link';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { isTerminal, type RunStatus } from '@/entities/run';
import type { FileRef } from '@/shared/lib/attachments';
import { FileDownloads } from '@/shared/ui/file-downloads';

export interface Msg {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  runId?: string;
  status?: RunStatus;
  step?: string;
  error?: string | null;
  /** 실행이 만든 파일(문서 내보내기 노드 등) */
  files?: FileRef[];
}

export function UserBubble({ text }: { text: string }) {
  return <div className="bg-primary-soft ml-auto max-w-[85%] rounded-lg px-4 py-2.5 text-sm whitespace-pre-wrap">{text}</div>;
}

export function AnswerBubble({ m }: { m: Msg }) {
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
      {m.files?.length ? <FileDownloads refs={m.files} /> : null}
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
