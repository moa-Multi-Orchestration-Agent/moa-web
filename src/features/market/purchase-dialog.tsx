'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, CreditCard, Loader2 } from 'lucide-react';
import { LICENSE_LABEL, usePurchase, type LicenseType, type PurchaseResult } from '@/entities/product';
import { isApiError } from '@/shared/lib/api-client';
import { formatDate, formatKrw } from '@/shared/lib/format';
import { Button } from '@/shared/ui/button';
import { CopyButton } from '@/shared/ui/copy-button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';

/** 모의 결제(설계서 미결 3: 학기 범위는 모의 결제) → 완료 화면 */
export function PurchaseDialog({ productId, title, license, amount, open, onOpenChange }: { productId: string; title: string; license: LicenseType; amount: number; open: boolean; onOpenChange: (o: boolean) => void }) {
  const purchase = usePurchase();
  const [card, setCard] = useState('4242 4242 4242 4242');
  const [done, setDone] = useState<PurchaseResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pay = () => {
    setError(null);
    purchase.mutate({ id: productId, license_type: license }, { onSuccess: setDone, onError: (e) => setError(isApiError(e) ? `${e.detail} (${e.code})` : e.message) });
  };
  const close = (o: boolean) => {
    onOpenChange(o);
    if (!o) {
      setDone(null);
      setError(null);
    }
  };
  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-md">
        {done ? (
          <div className="space-y-4" data-testid="purchase-done">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="text-success size-5" aria-hidden /> 구매를 마쳤습니다
              </DialogTitle>
              <DialogDescription>
                {title} · {LICENSE_LABEL[license]} · {formatKrw(done.purchase.amount_krw)}
              </DialogDescription>
            </DialogHeader>
            {done.clone ? (
              <div className="space-y-2 text-sm">
                <p>스튜디오에 복제본을 만들었습니다. 자유롭게 고쳐 쓸 수 있어요.</p>
                {done.clone.missing.length ? <p className="bg-warning-soft text-warning rounded-md px-3 py-2">실행 전에 연결하세요: {done.clone.missing.map((m) => m.label).join(', ')}</p> : null}
                <Button asChild className="w-full">
                  <Link href={done.clone.agent_id ? `/agents/${done.clone.agent_id}` : `/workflows/${done.clone.workflow_ids[0]}/edit`}>스튜디오에서 열기</Link>
                </Button>
              </div>
            ) : done.api ? (
              <div className="space-y-2 text-sm">
                <p>판매자 환경에서 실행되는 API를 부를 수 있습니다. 내 워크스페이스 API 키로 호출하고 토큰 비용은 내 워크스페이스에 청구됩니다.</p>
                <div className="bg-surface flex items-center gap-2 rounded-md border p-2">
                  <code className="min-w-0 flex-1 truncate font-mono text-xs">{done.api.endpoint_url}</code>
                  <CopyButton value={done.api.endpoint_url} iconOnly label="호출 주소 복사" />
                </div>
                <p className="text-muted text-xs">구독 만료: {formatDate(done.api.expires_at)} (매월 자동 갱신)</p>
                <Button asChild variant="outline" className="w-full">
                  <Link href="/market/purchases">구매 내역 보기</Link>
                </Button>
              </div>
            ) : null}
          </div>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); pay(); }} className="space-y-4">
            <DialogHeader>
              <DialogTitle>결제</DialogTitle>
              <DialogDescription>모의 결제입니다. 실제로 청구되지 않습니다.</DialogDescription>
            </DialogHeader>
            <dl className="bg-surface space-y-1 rounded-md p-3 text-sm">
              <div className="flex justify-between"><dt className="text-muted">상품</dt><dd>{title}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">라이선스</dt><dd>{LICENSE_LABEL[license]}</dd></div>
              <div className="flex justify-between font-bold"><dt>결제 금액</dt><dd>{license === 'api_sub' ? `월 ${formatKrw(amount)}` : formatKrw(amount)}</dd></div>
            </dl>
            {amount > 0 ? (
              <div className="space-y-1.5">
                <Label htmlFor="card">카드 번호</Label>
                <div className="relative">
                  <CreditCard className="text-muted absolute top-1/2 left-3 size-4 -translate-y-1/2" aria-hidden />
                  <Input id="card" value={card} onChange={(e) => setCard(e.target.value)} className="pl-9 font-mono" inputMode="numeric" />
                </div>
              </div>
            ) : null}
            {error ? <p role="alert" className="text-danger text-sm">{error}</p> : null}
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => close(false)}>취소</Button>
              <Button type="submit" disabled={purchase.isPending || (amount > 0 && card.replace(/\s/g, '').length < 12)} data-testid="pay">
                {purchase.isPending ? <Loader2 className="animate-spin" aria-hidden /> : null}
                {amount > 0 ? `${formatKrw(amount)} 결제` : '무료로 받기'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
