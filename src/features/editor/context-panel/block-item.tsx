'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Pin, Trash2 } from 'lucide-react';
import { ROLE_LABEL, type BlockPatch, type ContextBlockRow } from '@/entities/context';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { Label } from '@/shared/ui/label';
import { Slider } from '@/shared/ui/slider';
import { Textarea } from '@/shared/ui/textarea';
import { ROLE_STYLE } from './token-bar';

export function BlockItem({
  b,
  sources,
  onPatch,
  onDelete,
  readOnly,
  pending,
}: {
  b: ContextBlockRow;
  sources: ContextBlockRow[];
  onPatch: (b: ContextBlockRow, p: BlockPatch) => void;
  onDelete?: (b: ContextBlockRow) => void;
  readOnly?: boolean;
  pending?: boolean;
}) {
  const [edit, setEdit] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [content, setContent] = useState(b.content);
  const [priority, setPriority] = useState(b.priority);
  const first = b.content.split('\n')[0] ?? '';
  const preview = first.length > 60 ? `${first.slice(0, 60)}…` : first;

  return (
    <li className={cn('rounded-lg border p-3', !b.enabled && 'bg-surface opacity-60')} data-testid="context-block" data-role={b.role} data-enabled={b.enabled}>
      <div className="flex items-start gap-3">
        <span className={cn('mt-0.5 w-14 shrink-0 rounded px-1.5 py-0.5 text-center text-[11px] font-semibold', ROLE_STYLE[b.role].badge)}>{ROLE_LABEL[b.role]}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm" title={b.content}>
            {preview}
          </p>
          <p className="text-muted text-xs">
            {b.token_count.toLocaleString('ko-KR')} 토큰 · {b.source_node ?? `#${b.seq}`} · 우선순위 {b.priority}
            {!b.enabled && b.compressed_into ? ' · 요약에 포함됨' : !b.enabled ? ' · 꺼짐' : ''}
          </p>
        </div>
        <div className="flex shrink-0 gap-1.5">
          {b.pinned ? (
            <Button size="sm" variant="ghost" onClick={() => onPatch(b, { pinned: false })} disabled={readOnly || pending} aria-label={`${preview} 고정 풀기`}>
              <Pin className="fill-current" aria-hidden /> 고정됨
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={() => onPatch(b, { pinned: true })} disabled={readOnly || pending || !b.enabled} aria-label={`${preview} 고정`}>
              고정
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => onPatch(b, { enabled: !b.enabled })} disabled={readOnly || pending || b.pinned} aria-label={`${preview} ${b.enabled ? '끄기' : '켜기'}`}>
            {b.enabled ? '끄기' : '켜기'}
          </Button>
          <Button size="sm" variant="outline" onClick={() => { setContent(b.content); setPriority(b.priority); setEdit(true); }} disabled={readOnly || pending} aria-label={`${preview} 수정`}>
            수정
          </Button>
          {onDelete ? (
            <Button
              size="icon-sm"
              variant="ghost"
              className="text-danger hover:text-danger"
              onClick={() => setConfirmDelete(true)}
              disabled={readOnly || pending || b.pinned}
              aria-label={`${preview} 삭제`}
              title={b.pinned ? '고정을 풀어야 지울 수 있어요' : '삭제'}
            >
              <Trash2 aria-hidden />
            </Button>
          ) : null}
        </div>
      </div>
      {b.role === 'summary' && sources.length ? (
        <div className="mt-2 pl-[68px]">
          <button type="button" onClick={() => setExpanded((v) => !v)} className="text-primary inline-flex items-center gap-1 text-xs font-semibold" aria-expanded={expanded}>
            {expanded ? <ChevronDown className="size-3.5" aria-hidden /> : <ChevronRight className="size-3.5" aria-hidden />} 원문 펼치기 ({sources.length}개)
          </button>
          {expanded ? (
            <ul className="mt-2 space-y-1.5">
              {sources.map((s) => (
                <li key={s.id} className="bg-surface flex items-center gap-2 rounded px-2 py-1.5 text-xs">
                  <span className="text-muted w-10">{ROLE_LABEL[s.role]}</span>
                  <span className="min-w-0 flex-1 truncate">{s.content}</span>
                  <span className="text-muted tabular-nums">{s.token_count}</span>
                  <Button size="xs" variant="outline" onClick={() => onPatch(s, { enabled: true })} disabled={readOnly || pending}>
                    원문 켜기
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      {onDelete ? (
        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title={`${ROLE_LABEL[b.role]} 블록을 지울까요?`}
          description={
            b.role === 'summary' && sources.length
              ? `이 요약을 지우면 요약에 묶였던 원문 ${sources.length}개가 다시 켜집니다. 지운 블록은 되돌릴 수 없어요(스냅샷이 있으면 복원할 수 있어요).`
              : '다음 실행부터 모델에 들어가지 않습니다. 지운 블록은 되돌릴 수 없어요(스냅샷이 있으면 복원할 수 있어요). 잠시만 빼려면 "끄기"를 쓰세요.'
          }
          onConfirm={() => {
            onDelete(b);
            setConfirmDelete(false);
          }}
        />
      ) : null}
      <Dialog open={edit} onOpenChange={setEdit}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{ROLE_LABEL[b.role]} 블록 수정</DialogTitle>
            <DialogDescription>내용과 우선순위를 바꿉니다. 우선순위가 낮을수록 예산을 넘을 때 먼저 빠집니다.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor={`blk-${b.id}`}>내용</Label>
              <Textarea id={`blk-${b.id}`} value={content} onChange={(e) => setContent(e.target.value)} className="min-h-40 text-sm" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label id={`prio-${b.id}`}>우선순위</Label>
                <span className="font-mono text-sm">{priority}</span>
              </div>
              <Slider aria-labelledby={`prio-${b.id}`} min={0} max={100} step={5} value={[priority]} onValueChange={([v]) => setPriority(v ?? 50)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEdit(false)}>
              취소
            </Button>
            <Button
              onClick={() => {
                const p: BlockPatch = {};
                if (content !== b.content) p.content = content;
                if (priority !== b.priority) p.priority = priority;
                if (Object.keys(p).length) onPatch(b, p);
                setEdit(false);
              }}
            >
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </li>
  );
}
