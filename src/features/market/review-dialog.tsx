'use client';

import { useState } from 'react';
import { Star } from 'lucide-react';
import { toast } from 'sonner';
import { reviewFormSchema, useWriteReview } from '@/entities/license';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { Label } from '@/shared/ui/label';
import { Textarea } from '@/shared/ui/textarea';

export function ReviewDialog({ licenseId, title, open, onOpenChange }: { licenseId: string; title: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const write = useWriteReview();
  const submit = () => {
    const r = reviewFormSchema.safeParse({ rating, body });
    if (!r.success) return setError(r.error.issues[0]!.message);
    write.mutate({ licenseId, ...r.data }, { onSuccess: () => { toast.success('리뷰를 남겼습니다.'); onOpenChange(false); }, onError: (e) => setError(e.message) });
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>리뷰 쓰기</DialogTitle>
          <DialogDescription>{title} · 라이선스당 리뷰 1건</DialogDescription>
        </DialogHeader>
        <div role="radiogroup" aria-label="별점" className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n}점`} onClick={() => setRating(n)} className="rounded p-1">
              <Star className={cn('size-7', n <= rating ? 'fill-warning text-warning' : 'text-border')} aria-hidden />
            </button>
          ))}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="review-body">내용</Label>
          <Textarea id="review-body" value={body} onChange={(e) => setBody(e.target.value)} maxLength={1000} placeholder="써 보니 어땠나요?" />
        </div>
        {error ? <p role="alert" className="text-danger text-sm">{error}</p> : null}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>취소</Button>
          <Button onClick={submit} disabled={write.isPending}>남기기</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
