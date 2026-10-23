'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FlaskConical, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useStartTrial, useTrial } from '@/entities/product';
import { isApiError } from '@/shared/lib/api-client';
import { Button } from '@/shared/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { Label } from '@/shared/ui/label';
import { Textarea } from '@/shared/ui/textarea';

/** 무료로 3회 실행해 보기: 상품의 최신 버전을 내 워크스페이스에서 실행(trigger=market) */
export function TrialButton({ productId, title, disabled, disabledReason }: { productId: string; title: string; disabled?: boolean; disabledReason?: string }) {
  const trial = useTrial(productId);
  const start = useStartTrial(productId);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const remaining = trial.data?.remaining ?? 0;
  const run = () =>
    start.mutate(
      { query: text, question: text, text, topic: text },
      {
        onSuccess: (r) => {
          toast.success(`무료 체험을 시작했습니다. 남은 횟수 ${r.remaining}회`);
          setOpen(false);
          router.push(`/runs/${r.run.id}`);
        },
        onError: (e) => toast.error(isApiError(e) ? e.detail : e.message),
      },
    );
  return (
    <>
      <Button variant="outline" className="w-full" onClick={() => setOpen(true)} disabled={disabled || trial.isPending || remaining === 0} title={disabled ? disabledReason : undefined} data-testid="trial">
        <FlaskConical aria-hidden /> {remaining === 0 && trial.data ? '무료 체험을 모두 썼어요' : `무료로 ${trial.data ? remaining : 3}회 실행해 보기`}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={(e) => { e.preventDefault(); run(); }} className="space-y-4">
            <DialogHeader>
              <DialogTitle>무료로 실행해 보기</DialogTitle>
              <DialogDescription>{title}을(를) 구매 전에 내 워크스페이스에서 실행해 봅니다. 남은 횟수 {remaining}회 · 토큰 비용은 무료입니다.</DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor="trial-input">시험해 볼 입력</Label>
              <Textarea id="trial-input" value={text} onChange={(e) => setText(e.target.value)} placeholder="예: 알파AI, 베타랩스 비교해 줘" autoFocus />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>취소</Button>
              <Button type="submit" disabled={!text.trim() || start.isPending}>{start.isPending ? <Loader2 className="animate-spin" aria-hidden /> : null}실행</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
