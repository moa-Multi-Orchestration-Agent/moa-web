'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useReplyReview } from '@/entities/product';
import { Button } from '@/shared/ui/button';
import { Textarea } from '@/shared/ui/textarea';

/** 판매자 답글 달기(인라인) */
export function ReviewReply({ reviewId, existing, disabled }: { reviewId: string; existing?: { body: string } | null; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const reply = useReplyReview();
  if (existing) return <p className="bg-surface mt-1.5 rounded-md px-3 py-2 text-xs"><b>판매자 답글</b> · {existing.body}</p>;
  if (!open) return <button type="button" className="text-primary mt-1 text-xs font-semibold disabled:opacity-50" onClick={() => setOpen(true)} disabled={disabled}>답글 달기</button>;
  return (
    <form
      className="mt-2 space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        reply.mutate({ id: reviewId, body: text }, { onSuccess: () => { toast.success('답글을 남겼습니다.'); setOpen(false); }, onError: (er) => toast.error(er.message) });
      }}
    >
      <Textarea value={text} onChange={(e) => setText(e.target.value)} aria-label="답글 내용" className="min-h-16 text-sm" autoFocus />
      <div className="flex gap-2">
        <Button size="sm" type="submit" disabled={!text.trim() || reply.isPending}>남기기</Button>
        <Button size="sm" type="button" variant="ghost" onClick={() => setOpen(false)}>취소</Button>
      </div>
    </form>
  );
}
