'use client';

import { useMemo, useState } from 'react';
import { Camera, History, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useContextBlocks, useContextSession, useCreateSnapshot, usePatchBlock, useRestoreSnapshot, useSnapshots, type BlockPatch, type ContextBlockRow } from '@/entities/context';
import { isApiError } from '@/shared/lib/api-client';
import { formatTime } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import { LineTabs } from '@/shared/ui/line-tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover';
import { Skeleton } from '@/shared/ui/skeleton';
import { EmptyState, ErrorState, ListSkeleton } from '@/shared/ui/states';
import { BlockItem } from './block-item';
import { TokenBar } from './token-bar';

const TABS = [
  { value: 'prompt', label: '이번 프롬프트' },
  { value: 'short', label: '단기 기억' },
  { value: 'long', label: '장기 기억' },
  { value: 'episodic', label: '에피소딕' },
] as const;

/**
 * 컨텍스트 패널 (prompts 3-6⑤, Figma 07).
 * 에이전트 테스트 탭과 워크플로 편집기 오른쪽 탭에서 같이 쓴다.
 */
export function ContextPanel({
  sessionId,
  readOnly,
  onRegenerate,
  regenerating,
  className,
  showSnapshots = true,
}: {
  sessionId: string | null;
  readOnly?: boolean;
  showSnapshots?: boolean;
  onRegenerate?: () => void;
  regenerating?: boolean;
  className?: string;
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]['value']>('prompt');
  const session = useContextSession(sessionId);
  const blocks = useContextBlocks(sessionId);
  const patch = usePatchBlock(sessionId ?? '_');

  const onPatch = (b: ContextBlockRow, p: BlockPatch) =>
    patch.mutate(
      { block: b, patch: p },
      {
        onError: (e) =>
          toast.error(isApiError(e) && e.code === 'MOA-CTX-003' ? '다른 곳에서 먼저 수정했습니다. 최신 내용으로 다시 불러왔어요.' : e.message),
      },
    );

  const all = useMemo(() => blocks.data ?? [], [blocks.data]);
  const visible = useMemo(() => {
    const top = all.filter((b) => !(b.compressed_into && !b.enabled));
    if (tab === 'short') return top.filter((b) => b.role === 'user' || b.role === 'history');
    if (tab === 'long') return top.filter((b) => b.role === 'memory');
    if (tab === 'episodic') return top.filter((b) => b.role === 'summary');
    return top;
  }, [all, tab]);

  if (!sessionId) {
    return (
      <div className={cn('p-5', className)}>
        <EmptyState title="아직 컨텍스트가 없어요" description="테스트 실행을 하면 모델에 실제로 들어간 블록이 여기 쌓입니다." />
      </div>
    );
  }
  const budget = session.data?.budget_tokens ?? 8000;
  const threshold = session.data?.compress_threshold ?? 0.7;
  const used = all.filter((b) => b.enabled).reduce((s, b) => s + b.token_count, 0);
  const compressed = (session.data?.compressions.length ?? 0) > 0;
  const over = used > budget * threshold;

  return (
    <div className={cn('flex min-h-0 flex-col', className)}>
      <div className="space-y-4 border-b p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-subtitle font-bold">컨텍스트</h2>
          <span className="text-muted text-xs">다음 응답에 실제로 들어갈 내용</span>
        </div>
        <LineTabs label="컨텍스트 보기" value={tab} onChange={setTab} items={TABS.map((t) => ({ ...t }))} />
        {session.isPending || blocks.isPending ? (
          <Skeleton className="h-16 w-full" />
        ) : session.isError || blocks.isError ? (
          <ErrorState compact error={session.error ?? blocks.error} onRetry={() => { void session.refetch(); void blocks.refetch(); }} />
        ) : (
          <>
            <TokenBar blocks={all} budget={budget} threshold={threshold} />
            <p role="status" className={cn('rounded-md px-3 py-2 text-[13px] font-medium', over ? 'bg-warning-soft text-warning' : compressed ? 'bg-primary-soft text-primary' : 'bg-success-soft text-success')}>
              {over
                ? `임계치(${Math.round(threshold * 100)}%)를 넘었습니다. 다음 실행에서 오래된 비고정 블록이 요약됩니다.`
                : compressed
                  ? '압축이 일어났습니다. 요약 블록의 "원문 펼치기"로 원래 내용을 다시 켤 수 있어요.'
                  : '임계치 이내입니다. 끈 블록을 빼고 원문 그대로 전달됩니다.'}
            </p>
          </>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {blocks.isPending ? (
          <ListSkeleton rows={6} />
        ) : blocks.isError ? null : visible.length === 0 ? (
          <EmptyState title="이 범위에는 블록이 없어요" description={tab === 'episodic' ? '과거 실행 요약(에피소드 기억)이 아직 없습니다.' : tab === 'long' ? '장기 기억에서 불러온 블록이 없습니다.' : undefined} />
        ) : (
          <ul className="space-y-2" aria-label="컨텍스트 블록">
            {visible.map((b) => (
              <BlockItem key={b.id} b={b} sources={all.filter((s) => s.compressed_into === b.id)} onPatch={onPatch} readOnly={readOnly} pending={patch.isPending} />
            ))}
          </ul>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t p-4">
        <p className="text-muted min-w-0 flex-1 text-xs">끈 블록은 삭제되지 않고 비활성화되어, 이전 실행을 그대로 재현할 수 있습니다.</p>
        {showSnapshots ? <SnapshotControls sessionId={sessionId} readOnly={readOnly} /> : null}
        {onRegenerate ? (
          <Button size="sm" onClick={onRegenerate} disabled={readOnly || regenerating}>
            {regenerating ? <Loader2 className="animate-spin" aria-hidden /> : null}이 컨텍스트로 다시 생성
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function SnapshotControls({ sessionId, readOnly }: { sessionId: string; readOnly?: boolean }) {
  const snaps = useSnapshots(sessionId);
  const create = useCreateSnapshot(sessionId);
  const restore = useRestoreSnapshot(sessionId);
  return (
    <>
      <Button
        size="sm"
        variant="outline"
        disabled={readOnly || create.isPending}
        onClick={() =>
          create.mutate(`스냅샷 ${formatTime(new Date().toISOString())}`, {
            onSuccess: (s) => toast.success(`"${s.label}"을(를) 저장했습니다.`),
            onError: (e) => toast.error(e.message),
          })
        }
      >
        <Camera aria-hidden /> 스냅샷 저장
      </Button>
      <Popover>
        <PopoverTrigger asChild>
          <Button size="sm" variant="outline" aria-label="스냅샷 복원">
            <History aria-hidden /> 복원
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 p-2">
          <p className="text-muted px-2 pb-1 text-xs">복원하면 지금 블록은 꺼지고 스냅샷 블록이 다시 들어갑니다.</p>
          {snaps.isPending ? (
            <ListSkeleton rows={2} />
          ) : snaps.isError ? (
            <ErrorState compact error={snaps.error} onRetry={() => void snaps.refetch()} />
          ) : !snaps.data?.length ? (
            <p className="text-muted p-3 text-center text-sm">저장한 스냅샷이 없어요.</p>
          ) : (
            <ul>
              {snaps.data.map((s) => (
                <li key={s.id} className="hover:bg-surface flex items-center gap-2 rounded px-2 py-1.5 text-sm">
                  <span className="flex-1 truncate">{s.label}</span>
                  <span className="text-muted text-xs">블록 {s.block_count}</span>
                  <Button size="xs" variant="outline" disabled={readOnly || restore.isPending} onClick={() => restore.mutate(s.id, { onSuccess: () => toast.success('스냅샷으로 복원했습니다.'), onError: (e) => toast.error(e.message) })}>
                    복원
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </PopoverContent>
      </Popover>
    </>
  );
}

export default ContextPanel;
