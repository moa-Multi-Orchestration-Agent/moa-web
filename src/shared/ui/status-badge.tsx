import { Ban, CheckCircle2, CircleDashed, Clock, Hand, Loader2, XCircle } from 'lucide-react';
import { copy } from '@/shared/lib/copy';
import { Badge } from './badge';

const RUN_STATUS: Record<string, { variant: 'gray' | 'blue' | 'orange' | 'green' | 'red'; icon: React.ElementType }> = {
  queued: { variant: 'gray', icon: Clock },
  running: { variant: 'blue', icon: Loader2 },
  waiting_approval: { variant: 'orange', icon: Hand },
  succeeded: { variant: 'green', icon: CheckCircle2 },
  failed: { variant: 'red', icon: XCircle },
  canceled: { variant: 'gray', icon: Ban },
};

/** 실행 상태 배지. 색만으로 구분하지 않도록 아이콘과 글자를 함께 쓴다. */
export function RunStatusBadge({ status, className }: { status: string; className?: string }) {
  const s = RUN_STATUS[status] ?? { variant: 'gray' as const, icon: CircleDashed };
  const Icon = s.icon;
  return (
    <Badge variant={s.variant} className={className} data-status={status}>
      <Icon aria-hidden className={status === 'running' ? 'animate-spin' : undefined} />
      {copy.status.run[status] ?? status}
    </Badge>
  );
}

export function KindBadge({ kind }: { kind: 'agent' | 'workflow' }) {
  return <Badge variant={kind === 'agent' ? 'blue' : 'gray'}>{kind === 'agent' ? '에이전트' : '워크플로'}</Badge>;
}
